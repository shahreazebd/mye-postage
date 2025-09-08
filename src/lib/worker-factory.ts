import { type FlowJob, FlowProducer, Worker } from "bullmq"
import { prisma } from "prisma"
import type { XiorError } from "xior"
import { redisClient } from "./redis"
import { extractJobSummary } from "./utils"

export interface BaseJobData<T = unknown> {
  payload: T
  token: string
  companyId: string
  shipmentId: string
}

export interface WorkerConfig<T = unknown, R = unknown> {
  carrierName: string
  orderQueueName: string
  shipmentQueueName: string
  processOrder: (
    companyId: string,
    shipmentId: string,
    token: string,
    payload: T,
  ) => Promise<R>
  concurrency?: number
  limiter?: {
    max: number
    duration: number
  }
  // Custom hooks for carrier-specific logic
  beforeProcess?: (jobData: BaseJobData<T>) => Promise<void>
  afterProcess?: (result: R, jobData: BaseJobData<T>) => Promise<void>
  customErrorHandler?: (
    error: unknown,
    jobData: BaseJobData<T>,
  ) => Promise<{ success: false; error: string } | { success: true; result: R }>

  // Shipment worker hooks
  beforeShipmentProcess?: (shipmentId: string, totalJobs: number) => Promise<void>
  afterShipmentProcess?: (
    shipmentId: string,
    hasSuccess: boolean,
    children: Record<string, unknown>,
  ) => Promise<void>
  customShipmentErrorHandler?: (
    error: unknown,
    shipmentId: string,
  ) => Promise<{ success: false; error: string } | { success: true; status: string }>
}

const flowProducer = new FlowProducer({ connection: redisClient })

export const CarrierWorkerFactory = {
  createBatchFlow<T = unknown>(
    config: WorkerConfig<T>,
    shipmentId: string,
    jobs: BaseJobData<T>[],
  ) {
    const flow: FlowJob = {
      name: `${config.carrierName.toLowerCase()}-shipment-flow`,
      queueName: config.shipmentQueueName,
      data: {
        shipmentId,
        totalJobs: jobs.length,
      },
      children: jobs.map((jobData, index) => ({
        name: `${config.carrierName.toLowerCase()}-order-flow`,
        queueName: config.orderQueueName,
        data: {
          shipmentId,
          jobData,
          jobIndex: index,
        },
        opts: { attempts: 2, backoff: { type: "exponential", delay: 1000 } },
      })),
    }

    return flowProducer.add(flow).then(extractJobSummary)
  },

  createOrderWorker<T = unknown, R = unknown>(config: WorkerConfig<T, R>) {
    return new Worker<{
      [key: string]: unknown
      jobData: BaseJobData<T>
    }>(
      config.orderQueueName,
      async (job) => {
        const { jobData } = job.data

        try {
          // Custom pre-processing hook
          if (config.beforeProcess) {
            await config.beforeProcess(jobData)
          }

          const result = await config.processOrder(
            jobData.companyId,
            jobData.shipmentId,
            jobData.token,
            jobData.payload,
          )

          // Custom post-processing hook
          if (config.afterProcess) {
            await config.afterProcess(result, jobData)
          }

          return { success: true, result }
        } catch (error) {
          console.log({ error: `error from ${config.carrierName} child worker` })

          // Custom error handling hook
          if (config.customErrorHandler) {
            return await config.customErrorHandler(error, jobData)
          }

          return { success: false, error: (error as XiorError).message }
        }
      },
      {
        connection: redisClient,
        concurrency: config.concurrency || 10,
        ...(config.limiter && { limiter: config.limiter }),
        removeOnComplete: { count: 0 },
        removeOnFail: { count: 0 },
      },
    )
  },

  createShipmentWorker<T = unknown>(config: WorkerConfig<T>) {
    return new Worker<{
      [key: string]: unknown
      token: string
    }>(
      config.shipmentQueueName,
      async (job) => {
        const id = job.data.shipmentId as string
        const totalJobs = job.data.totalJobs as number

        try {
          // Custom pre-processing hook
          if (config.beforeShipmentProcess) {
            await config.beforeShipmentProcess(id, totalJobs)
          }

          const children = await job.getChildrenValues()
          const hasSuccess = Object.values(children).some((child) => child.success)

          console.log({ children, hasSuccess })

          await prisma.shipment.update({
            where: { id },
            data: { status: hasSuccess ? "SUCCESS" : "FAILED" },
          })

          // Custom post-processing hook
          if (config.afterShipmentProcess) {
            await config.afterShipmentProcess(id, hasSuccess, children)
          }

          return { shipmentId: id, status: hasSuccess ? "success" : "failed" }
        } catch (error) {
          console.log({ error: `error from ${config.carrierName} shipment worker` })

          // Custom error handling hook
          if (config.customShipmentErrorHandler) {
            return await config.customShipmentErrorHandler(error, id)
          }

          return { success: false, error: (error as Error).message }
        }
      },
      {
        connection: redisClient,
        concurrency: config.concurrency || 10,
        removeOnComplete: { count: 0 },
        removeOnFail: { count: 0 },
      },
    )
  },
}
