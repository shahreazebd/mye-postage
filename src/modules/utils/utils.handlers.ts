import type { AppRouteHandler } from "@/lib/types"
import puppeteer from "puppeteer"
import type {
  ConvertFileRoute,
  ConvertPdfRoute,
  FindZPLRoute,
  MergePDFRoute,
  UploadFileRoute,
  ValidateAddressRoute,
} from "./utils.routes"
import {
  getBase64,
  isValidBase64Pdf,
  mergePDFsFromUrls,
  mergePdf,
  uploadToS3,
} from "./utils.services"

export const convertFile: AppRouteHandler<ConvertFileRoute> = async (c) => {
  const { scale, urls } = c.req.valid("json")

  const promises = urls.map((e: string) => {
    return getBase64(e)
  })

  const data = await Promise.allSettled(promises)

  const pdfs = data
    .filter(({ status }) => status === "fulfilled")
    .map((e) => (e as { value: { url: string; base64: string } }).value)

  const { zpl } = isValidBase64Pdf(pdfs)

  if (zpl.length) {
    return c.json(
      {
        success: false,
        message: "Some ZPL urls not valid",
        invalid: zpl.map((e) => e.url),
      },
      400,
    )
  }

  const b64 = await mergePdf(
    pdfs.map((e) => e.base64),
    scale,
  )

  return c.json(
    {
      success: true,
      message: "PDF merged successfully",
      base64: b64,
    },
    200,
  )
}

export const convertPdf: AppRouteHandler<ConvertPdfRoute> = async (c) => {
  const { html } = c.req.valid("json")

  const browser = await puppeteer.launch({
    headless: "shell",
    executablePath: "/usr/bin/chromium",
    args: ["--no-sandbox"],
  })

  const page = await browser.newPage()

  await page.setContent(html, { waitUntil: "domcontentloaded" })

  // To reflect CSS used for screens instead of print
  await page.emulateMediaType("screen")

  // Downlaod the PDF
  const pdf = await page.pdf({
    // margin: { top: "100px", right: "50px", bottom: "100px", left: "50px" },
    printBackground: true,
    format: "A4",
  })

  const base64 = Buffer.from(pdf).toString("base64")

  await browser.close()

  return c.json(
    {
      success: true,
      message: "HTML string to PDF converted successfully",
      base64,
    },
    200,
  )
}

export const mergePDF: AppRouteHandler<MergePDFRoute> = async (c) => {
  const body = await c.req.valid("json")

  c.header("Content-Type", "application/pdf")
  c.header("Transfer-Encoding", "chunked")
  c.header("Cache-Control", "no-cache")

  const mergedPdfBytes = await mergePDFsFromUrls(body, {
    maxRetries: 2,
    retryDelay: 500,
    timeout: 15000,
    batchSize: 5,
    processingBatchSize: 50,
    maxConcurrent: 10,
  })

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
  const filename = `merged-${body.urls.length}pdfs-${timestamp}.pdf`

  c.header("Content-Type", "application/pdf")
  c.header("Content-Disposition", `attachment; filename="${filename}"`)
  c.header("Content-Length", mergedPdfBytes.length.toString())
  c.header("Cache-Control", "no-cache, no-store, must-revalidate")
  c.header("X-PDF-Count", body.urls.length.toString())
  c.header("X-PDF-Scale", (body.scale || 1.0).toString())

  return c.body(mergedPdfBytes)
}

export const findZPL: AppRouteHandler<FindZPLRoute> = async (c) => {
  const { urls } = c.req.valid("json")

  const promises = urls.map((e: string) => {
    return getBase64(e)
  })

  const data = await Promise.allSettled(promises)

  const pdfs = data
    .filter(({ status }) => status === "fulfilled")
    .map((e) => (e as { value: { url: string; base64: string } }).value)

  const { zpl, pdf } = isValidBase64Pdf(pdfs)

  return c.json(
    {
      success: true,
      message: "ZPL found successfully",
      isZPLFound: !!zpl.length,
      zpl: zpl.map((e) => e.url),
      pdf: pdf.map((e) => e.url),
    },
    200,
  )
}

export const uploadFile: AppRouteHandler<UploadFileRoute> = async (c) => {
  const { companyId, batchId, orderId, base64 } = c.req.valid("json")

  const url = await uploadToS3(companyId, batchId, orderId, base64)

  return c.json(
    {
      success: true,
      message: "File uploaded successfully",
      url,
    },
    200,
  )
}

export const validateAddress: AppRouteHandler<ValidateAddressRoute> = async (c) => {
  const addresses = c.req.valid("json")

  return c.json(
    {
      addresses,
    },
    200,
  )
}
