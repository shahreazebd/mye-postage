import { type BaseJobData, CarrierWorkerFactory } from "@/lib/worker-factory"
import { type EvriParcelPayload, createEvriShipment } from "./evri.services"

type EvriJobData = BaseJobData<EvriParcelPayload>

const evriConfig = {
  carrierName: "Evri",
  orderQueueName: "evriOrderProcessingQueue",
  shipmentQueueName: "evriShipmentProcessingQueue",
  processOrder: createEvriShipment,
  concurrency: 10,
  limiter: {
    max: 2,
    duration: 1000,
  },

  // Evri-specific pre-processing
  beforeProcess: async (jobData: EvriJobData) => {
    console.log(`Processing Evri shipment ${jobData.shipmentId}`)
    // Validate Evri token is still valid
    if (!jobData.token) {
      throw new Error("Evri access token is required")
    }
  },

  // Evri-specific post-processing
  afterProcess: async (_result: unknown, jobData: EvriJobData) => {
    console.log(`Evri shipment ${jobData.shipmentId} processed successfully`)
    // Could add custom logging, metrics, or notifications here
  },

  // Evri-specific error handling
  customErrorHandler: async (error: unknown, jobData: EvriJobData) => {
    console.error(`Evri error for shipment ${jobData.shipmentId}:`, error)

    // Handle specific Evri API errors
    if (error && typeof error === "object" && "response" in error) {
      const apiError = error as { response?: { status?: number } }
      if (apiError.response?.status === 401) {
        return {
          success: false as const,
          error: "Evri authentication failed - token may be expired",
        }
      }

      if (apiError.response?.status === 429) {
        return { success: false as const, error: "Evri rate limit exceeded - will retry" }
      }
    }

    // Default error handling
    const errorMessage = error instanceof Error ? error.message : "Unknown Evri error"
    return { success: false as const, error: errorMessage }
  },

  // Evri-specific shipment processing hooks
  beforeShipmentProcess: async (shipmentId: string, totalJobs: number) => {
    console.log(
      `Starting Evri shipment processing for ${shipmentId} with ${totalJobs} orders`,
    )
    // Could validate shipment status, check carrier availability, etc.
  },

  afterShipmentProcess: async (
    shipmentId: string,
    hasSuccess: boolean,
    _children: Record<string, unknown>,
  ) => {
    console.log(
      `Evri shipment ${shipmentId} completed with ${hasSuccess ? "success" : "failure"}`,
    )
    // Could send notifications, update metrics, trigger follow-up actions
  },

  customShipmentErrorHandler: async (error: unknown, shipmentId: string) => {
    console.error(`Evri shipment error for ${shipmentId}:`, error)
    // Could implement retry logic, alerting, etc.
    return { success: false as const, error: (error as Error).message }
  },
} as const

export async function createEvriBatchFlow(shipmentId: string, jobs: EvriJobData[]) {
  return CarrierWorkerFactory.createBatchFlow(evriConfig, shipmentId, jobs)
}

// Create workers
CarrierWorkerFactory.createOrderWorker(evriConfig)
CarrierWorkerFactory.createShipmentWorker(evriConfig)
