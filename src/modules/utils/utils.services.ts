import { Buffer } from "node:buffer"
import { exec } from "node:child_process"
import fs from "node:fs"
import { PutObjectCommand } from "@aws-sdk/client-s3"
import { PDFDocument } from "pdf-lib"
import xior from "xior"

import { s3 } from "@/configs/s3"
import { ApiError } from "@/lib/api-error"
import { env } from "@/lib/env"

export function isValidBase64Pdf(
  pdfs: {
    url: string
    base64: string
  }[],
) {
  const zpl = [] as {
    url: string
    base64: string
  }[]

  const pdf = [] as {
    url: string
    base64: string
  }[]

  for (const { base64, url } of pdfs) {
    const pdfBuffer = Buffer.from(base64, "base64")
    const pdfHeader = pdfBuffer.toString("utf-8", 0, 5)

    if (pdfHeader === "%PDF-") {
      pdf.push({ url, base64 })
    } else {
      zpl.push({ url, base64 })
    }
  }

  return { pdf, zpl }
}

export async function getBase64(url: string) {
  const response = await xior.get(url, { responseType: "arraybuffer" })
  const base64 = await Buffer.from(response.data, "binary").toString("base64")

  return { url, base64 }
}

async function compressPdf(base64Input: string): Promise<string> {
  const inputFilePath = "./temp_input.pdf"
  const outputFilePath = "./temp_output.pdf"

  // Decode the base64 string and save it as a PDF file
  fs.writeFileSync(inputFilePath, Buffer.from(base64Input, "base64"))

  return new Promise((resolve, reject) => {
    // Construct the Ghostscript command
    const gsCommand = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile=${outputFilePath} ${inputFilePath}`

    // Execute the command
    exec(gsCommand, (error) => {
      if (error) {
        reject(`Error during compression: ${error.message}`)
        return
      }

      try {
        // Read the compressed file and encode it back to base64
        const compressedBase64 = fs.readFileSync(outputFilePath).toString("base64")

        // Cleanup temporary files
        fs.unlinkSync(inputFilePath)
        fs.unlinkSync(outputFilePath)

        resolve(compressedBase64)
      } catch (readError) {
        reject(`Error reading or cleaning up files: ${readError}`)
      }
    })
  })
}

export async function mergePdf(pdfs: string[], scale = 1): Promise<string> {
  const mergedPdf = await PDFDocument.create()

  for (const b64 of pdfs) {
    const pdf = await PDFDocument.load(b64)
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices())

    for (const page of copiedPages) {
      if (scale !== 1) {
        const { width, height } = page.getSize()

        // Scale the page content
        page.setWidth(width * scale)
        page.setHeight(height * scale)
        page.scaleContent(scale, scale)
      }

      mergedPdf.addPage(page)
    }
  }

  const b64 = await mergedPdf.saveAsBase64()

  return await compressPdf(b64)
}

export async function uploadToS3(
  companyId: string,
  shipmentId: string,
  orderId: string,
  base64: string,
) {
  // Handle file upload logic here
  const matches = base64.match(/^data:(.+);base64,(.+)$/)
  if (!matches || matches.length !== 3) {
    throw new ApiError(400, "Invalid base64 string")
  }

  const contentType = matches[1] // e.g. "application/pdf"
  const base64Data = matches[2]
  const buffer = Buffer.from(base64Data, "base64")

  const extension = getExtensionFromMime(contentType)
  const fileName = `${orderId}.${extension}`
  const key = `mye-v2/${companyId}/shipping/${shipmentId}/${fileName}`

  const command = new PutObjectCommand({
    Bucket: env.BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: "public-read",
  })

  await s3.send(command)

  return `https://${env.BUCKET_NAME}.${env.BUCKET_REGION}.digitaloceanspaces.com/${key}`
}

function getExtensionFromMime(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf"
    case "image/jpeg":
      return "jpg"
    case "image/png":
      return "png"
    case "image/webp":
      return "webp"
    default:
      return "bin"
  }
}

// =============

interface MergePDFRequest {
  urls: string[]
  scale?: number
}

interface MergeOptions {
  maxRetries?: number
  retryDelay?: number
  timeout?: number
  batchSize?: number
  processingBatchSize?: number
  maxConcurrent?: number
}

export async function mergePDFsFromUrls(
  payload: MergePDFRequest,
  options: MergeOptions = {},
): Promise<Uint8Array> {
  const {
    maxRetries = 2,
    retryDelay = 500,
    timeout = 30000,
    batchSize = 5,
    processingBatchSize = 50,
    maxConcurrent = 10,
  } = options

  const { urls, scale = 1.0 } = payload

  if (!urls || urls.length === 0) {
    throw new Error("No URLs provided")
  }

  if (scale <= 0) {
    throw new Error("Scale must be greater than 0")
  }

  const mergedPdf = await PDFDocument.create()
  // let processedCount = 0

  for (let batchStart = 0; batchStart < urls.length; batchStart += processingBatchSize) {
    const batchEnd = Math.min(batchStart + processingBatchSize, urls.length)
    const currentBatch = urls.slice(batchStart, batchEnd)

    await processBatchWithSemaphore(currentBatch, mergedPdf, scale, {
      maxRetries,
      retryDelay,
      timeout,
      batchSize,
      maxConcurrent,
    })

    // processedCount += currentBatch.length
  }

  const mergedPdfBytes = await mergedPdf.save({
    useObjectStreams: false,
    addDefaultPage: false,
    objectsPerTick: 25,
    updateFieldAppearances: false,
  })

  return mergedPdfBytes
}

/**
 * Process a batch of PDFs with controlled concurrency
 */
async function processBatchWithSemaphore(
  urls: string[],
  mergedPdf: PDFDocument,
  scale: number,
  options: {
    maxRetries: number
    retryDelay: number
    timeout: number
    batchSize: number
    maxConcurrent: number
  },
): Promise<void> {
  const semaphore = new Semaphore(options.maxConcurrent)

  const promises = urls.map(async (url, index) => {
    await semaphore.acquire()

    try {
      await processSinglePDF(url, index, mergedPdf, scale, options)
    } finally {
      semaphore.release()
    }
  })

  await Promise.all(promises)
}

/**
 * Process a single PDF with retry logic
 */
async function processSinglePDF(
  url: string,
  index: number,
  mergedPdf: PDFDocument,
  scale: number,
  options: {
    maxRetries: number
    retryDelay: number
    timeout: number
    batchSize: number
  },
): Promise<void> {
  const { maxRetries, retryDelay, timeout, batchSize } = options
  let lastError: Error | null = null

  for (let retry = 0; retry <= maxRetries; retry++) {
    try {
      // Create AbortController for timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // Fetch with optimized headers
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: "application/pdf",
          "User-Agent": "PDF-Merger-Batch/1.0",
          "Accept-Encoding": "gzip, deflate",
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // Stream processing for memory efficiency
      const arrayBuffer = await response.arrayBuffer()

      // Size check (reduced for batch processing)
      if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
        // 50MB limit per PDF
        throw new Error("PDF file too large (>50MB)")
      }

      // Load PDF
      const pdfDoc = await PDFDocument.load(arrayBuffer)
      const pageIndices = pdfDoc.getPageIndices()

      // Process pages in smaller batches for memory efficiency
      for (let j = 0; j < pageIndices.length; j += batchSize) {
        const pageBatch = pageIndices.slice(j, j + batchSize)
        const copiedPages = await mergedPdf.copyPages(pdfDoc, pageBatch)

        // Add pages with scaling
        for (const page of copiedPages) {
          if (scale !== 1.0) {
            const { width, height } = page.getSize()
            const newWidth = width * scale
            const newHeight = height * scale
            page.scale(scale, scale)
            page.setSize(newWidth, newHeight)
          }
          mergedPdf.addPage(page)
        }
      }

      // Success - break retry loop
      lastError = null
      break
    } catch (error) {
      lastError = error as Error

      if (retry < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay))
      }
    }
  }

  if (lastError) {
    console.error(`❌ Failed to process PDF ${index + 1}: ${lastError.message}`)
    // Don't throw - continue with other PDFs
  }
}

/**
 * Semaphore class for controlling concurrency
 */
class Semaphore {
  private permits: number
  private waiting: Array<() => void> = []

  constructor(permits: number) {
    this.permits = permits
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return
    }

    return new Promise<void>((resolve) => {
      this.waiting.push(resolve)
    })
  }

  release(): void {
    this.permits++

    if (this.waiting.length > 0) {
      const resolve = this.waiting.shift()
      if (resolve) {
        this.permits--
        resolve()
      }
    }
  }
}
