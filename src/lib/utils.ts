import type { JobNode } from "bullmq"
import z from "zod"

export const JobInfoSchema = z.object({
  parentJobId: z.string(),
  parentQueue: z.string(),
  shipmentId: z.string(),
  totalJobs: z.string(),
  orders: z.array(
    z.object({
      jobId: z.string(),
      orderId: z.string(),
      marketPlaceOrderId: z.string(),
    }),
  ),
})

export function extractJobSummary(input: JobNode): z.infer<typeof JobInfoSchema> {
  const res = {
    parentJobId: input.job.id,
    parentQueue: input.job.queueQualifiedName,
    shipmentId: input.job.data.shipmentId,
    totalJobs: input.job.data.totalJobs,
    orders: (input.children ?? []).map((child) => {
      const payload = child.job.data.jobData.payload
      return {
        jobId: child.job.id,
        orderId: payload.orderId,
        marketPlaceOrderId: payload.marketPlaceOrderId,
      }
    }),
  }
  return res as z.infer<typeof JobInfoSchema>
}

export function chunk<T>(array: T[], size: number): T[][] {
  if (!Array.isArray(array) || size <= 0) return []
  if (array.length === 0) return []

  const result: T[][] = []
  const length = array.length
  const chunkCount = Math.ceil(length / size)

  for (let i = 0; i < chunkCount; i++) {
    const start = i * size
    result.push(array.slice(start, start + size))
  }

  return result
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export function removeSpecialChar<T extends Record<string, any>>(arr: T[] | null): T[] {
  if (!arr) return []

  return arr.map((item) => {
    const tempObj = { ...item }

    for (const key in tempObj) {
      if (Object.hasOwn(tempObj, key) && typeof tempObj[key] === "string") {
        tempObj[key] = tempObj[key].replace(/["|,]/g, " ")
      }
    }

    return tempObj
  })
}

export function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  const firstName = parts.shift() || ""
  const lastName = parts.join(" ")
  return { firstName, lastName }
}
