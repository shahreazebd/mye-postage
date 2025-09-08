import { extractJobSummary } from "@/lib/utils"
import { type FlowJob, FlowProducer, Worker } from "bullmq"
import { prisma } from "prisma"
import type { XiorError } from "xior"
import { redisClient } from "../../lib/redis"
import { type DHLPayload, createDHLShipmentSandbox } from "./dhl.services"

const flowProducer = new FlowProducer({ connection: redisClient })

type DHLJobData = {
  payload: DHLPayload
  token: string
  companyId: string
  shipmentId: string
}

export async function createDHLBatchFlow(batchId: string, jobs: DHLJobData[]) {
  const flow: FlowJob = {
    name: "dhl-shipment-flow",
    queueName: "dhlShipmentProcessingQueue",
    data: { batchId, totalJobs: jobs.length },
    children: jobs.map((jobData, index) => ({
      name: "dhl-order-flow",
      queueName: "dhlOrderProcessingQueue",
      data: { batchId, jobData, jobIndex: index },
      opts: { attempts: 2, backoff: { type: "exponential", delay: 1000 } },
    })),
  }

  const res = await flowProducer.add(flow)

  return extractJobSummary(res)
}

new Worker<{
  batchId: string
  jobData: DHLJobData
}>(
  "dhlOrderProcessingQueue",
  async (job) => {
    const { jobData } = job.data

    try {
      const result = await createDHLShipmentSandbox(
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
  batchId: string
  token: string
  dhlPayload: DHLPayload
}>(
  "dhlShipmentProcessingQueue",
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
