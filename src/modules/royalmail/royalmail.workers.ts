import { type FlowJob, FlowProducer, Worker } from "bullmq"
import type { XiorError } from "xior"

import { extractJobSummary } from "@/lib/utils"
import { prisma } from "prisma"
import { redisClient } from "../../lib/redis"
import { createRoyalmailShipment, type royalmailPayload } from "./royalmail.services"

const flowProducer = new FlowProducer({ connection: redisClient })

interface RoyalmailJobData {
  payload: royalmailPayload
  token: string
  companyId: string
  shipmentId: string
}

export async function createRoyalmailBatchFlow(
  batchId: string,
  jobs: RoyalmailJobData[],
) {
  const flow: FlowJob = {
    name: "royalmail-shipment-flow",
    queueName: "royalmailShipmentProcessingQueue",
    data: { batchId, totalJobs: jobs.length },
    children: jobs.map((jobData, index) => ({
      name: "royalmail-order-flow",
      queueName: "royalmailOrderProcessingQueue",
      data: { batchId, jobData, jobIndex: index },
      opts: { attempts: 2, backoff: { type: "exponential", delay: 1000 } },
    })),
  }

  const res = await flowProducer.add(flow)

  return extractJobSummary(res)
}

new Worker<{
  batchId: string
  jobData: RoyalmailJobData
}>(
  "royalmailOrderProcessingQueue",
  async (job) => {
    const { jobData } = job.data

    try {
      const result = await createRoyalmailShipment(
        jobData.companyId,
        jobData.shipmentId,
        jobData.token,
        jobData.payload,
      )
      return { success: true, result }
    } catch (error) {
      console.log({ error: "error from child worker" })

      return { success: false, error: (error as XiorError).message }
    }
  },
  {
    connection: redisClient,
    concurrency: 10,
    limiter: {
      max: 2,
      duration: 1000,
    },

    removeOnComplete: { count: 0 },
    removeOnFail: { count: 0 },
  },
)

new Worker<{
  batchId: string
  token: string
  royalmailPayload: royalmailPayload
}>(
  "royalmailShipmentProcessingQueue",
  async (job) => {
    const { batchId } = job.data
    const children = await job.getChildrenValues()

    const hasSuccess = Object.values(children).some((child) => child.success)

    console.log({ children, hasSuccess })

    await prisma.shipment.update({
      where: { id: batchId },
      data: { status: hasSuccess ? "SUCCESS" : "FAILED" },
    })

    return { batchId, status: hasSuccess ? "success" : "failed" }
  },
  {
    connection: redisClient,
    concurrency: 10,

    removeOnComplete: { count: 0 },
    removeOnFail: { count: 0 },
  },
)
