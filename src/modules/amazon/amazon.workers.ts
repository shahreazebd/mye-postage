import { type FlowJob, FlowProducer, Worker } from "bullmq"
import type { XiorError } from "xior"

import { redisClient } from "@/lib/redis"
import { extractJobSummary } from "@/lib/utils"
import { prisma } from "prisma"
import { type AmazonBuyShippingPayload, buyAmazonLabel } from "./amazon.services"

const flowProducer = new FlowProducer({ connection: redisClient })

type AmazonJobData = {
  payload: AmazonBuyShippingPayload
  token: string
  companyId: string
  shipmentId: string
}

export async function createAmazonBatchFlow(shipmentId: string, jobs: AmazonJobData[]) {
  const flow: FlowJob = {
    name: "amazon-shipment-flow",
    queueName: "amazonShipmentProcessingQueue",
    data: { shipmentId, totalJobs: jobs.length },
    children: jobs.map((jobData, index) => ({
      name: "amazon-order-flow",
      queueName: "amazonOrderProcessingQueue",
      data: { shipmentId, jobData, jobIndex: index },
      opts: { attempts: 2, backoff: { type: "exponential", delay: 1000 } },
    })),
  }

  const res = await flowProducer.add(flow)

  return extractJobSummary(res)
}

new Worker<{
  shipementId: string
  jobData: AmazonJobData
}>(
  "amazonOrderProcessingQueue",
  async (job) => {
    const { jobData } = job.data

    try {
      const result = await buyAmazonLabel(
        jobData.companyId,
        jobData.shipmentId,
        jobData.token,
        jobData.payload,
      )
      return { success: true, result }
    } catch (error) {
      return { success: false, error: (error as XiorError).message }
    }
  },
  {
    connection: redisClient,
    concurrency: 5,
    removeOnComplete: { count: 0 },
    removeOnFail: { count: 0 },
    limiter: {
      duration: 1000,
      max: 5,
    },
  },
)

new Worker<{
  shipmentId: string
  token: string
  amazonPayload: AmazonBuyShippingPayload
}>(
  "amazonShipmentProcessingQueue",
  async (job) => {
    const { shipmentId } = job.data
    const children = await job.getChildrenValues()

    const hasSuccess = Object.values(children).some((child) => child.success)

    await prisma.shipment.update({
      where: { id: shipmentId },
      data: { status: hasSuccess ? "SUCCESS" : "FAILED" },
    })

    return { shipmentId, status: hasSuccess ? "success" : "failed" }
  },
  {
    connection: redisClient,
    concurrency: 5,
    removeOnComplete: { count: 0 },
    removeOnFail: { count: 0 },
  },
)
