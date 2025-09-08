import { type FlowJob, FlowProducer, Worker } from "bullmq"
import type { XiorError } from "xior"

import { redisClient } from "@/lib/redis"
import { extractJobSummary } from "@/lib/utils"
import { prisma } from "prisma"
import { type FedexPayload, createFedexShipmentSandbox } from "./fedex.services"

const flowProducer = new FlowProducer({ connection: redisClient })

type FedexJobData = {
  payload: FedexPayload
  token: string
  companyId: string
  shipmentId: string
}

export async function createFedexBatchFlow(shipmentId: string, jobs: FedexJobData[]) {
  const flow: FlowJob = {
    name: "fedex-shipment-flow",
    queueName: "fedexShipmentProcessingQueue",
    data: { shipmentId, totalJobs: jobs.length },
    children: jobs.map((jobData, index) => ({
      name: "fedex-order-flow",
      queueName: "fedexOrderProcessingQueue",
      data: { shipmentId, jobData, jobIndex: index },
      opts: { attempts: 2, backoff: { type: "exponential", delay: 1000 } },
    })),
  }

  const res = await flowProducer.add(flow)

  return extractJobSummary(res)
}

new Worker<{
  shipementId: string
  jobData: FedexJobData
}>(
  "fedexOrderProcessingQueue",
  async (job) => {
    const { jobData } = job.data

    try {
      const result = await createFedexShipmentSandbox(
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
    concurrency: 10,
    removeOnComplete: { count: 0 },
    removeOnFail: { count: 0 },
  },
)

new Worker<{
  shipmentId: string
  token: string
  fedexPayload: FedexPayload
}>(
  "fedexShipmentProcessingQueue",
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
    concurrency: 10,
    removeOnComplete: { count: 0 },
    removeOnFail: { count: 0 },
  },
)
