import { ApiError } from "@/lib/api-error"
import { env } from "@/lib/env"
import { XiorError } from "xior"
import { AmazonOrderMetadataSchema, type Shipment } from "../shipments/shipments.schemas"
import { uploadToS3 } from "../utils/utils.services"
import type {
  AmazonRatesResponse,
  BuyAmazonLabelResponse,
  GetTokenResponse,
} from "./amazon.types"
import { createAmazonBatchFlow } from "./amazon.workers"

import { http } from "@/lib/xior"
import { HTTPException } from "hono/http-exception"
import { updateOrderService } from "../orders/orders.services"
import { AmazonCredentialsSchema } from "./amazon.schemas"

export async function verifyAmazonCredentials(refreshToken: string) {
  try {
    const res = await http.request<GetTokenResponse>({
      method: "POST",
      url: "https://api.amazon.co.uk/auth/o2/token",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: env.LWA_APP_ID,
        client_secret: env.LWA_CLIENT_SECRET,
      }),
    })

    return res.data
  } catch (err) {
    if (err instanceof XiorError) {
      throw new ApiError(
        err.response?.status || 500,
        err?.response?.statusText || "Unknown error",
        err?.response?.data,
      )
    }
  }
}

export async function getAmazonShippingRates(refreshToken: string, payload: object) {
  const creds = await verifyAmazonCredentials(refreshToken)

  if (!creds) throw "error"

  try {
    const res = await http.request<AmazonRatesResponse>({
      method: "POST",
      url: "https://sandbox.sellingpartnerapi-eu.amazon.com/shipping/v2/shipments/rates",
      headers: {
        "x-amz-access-token": creds.access_token,
      },
      data: payload,
    })

    console.log("Amazon Rates Response:", res.data)

    return res.data
  } catch (err) {
    if (err instanceof XiorError) {
      throw new ApiError(
        err.response?.status || 500,
        err?.response?.statusText || "Unknown error",
        { ...err?.response?.data, orderId: "1234" },
      )
    }
  }
}

function convertToAmazonFormat(payload: Shipment) {
  const amazonShippingPayload = payload.orders.map((order) => {
    const orderMetadata = AmazonOrderMetadataSchema.parse(order.metadata)
    return {
      orderId: order.id,
      amazonPayload: orderMetadata,
      marketPlaceOrderId: order.marketplaceOrderId,
    }
  })

  return amazonShippingPayload
}

export type AmazonBuyShippingPayload = ReturnType<typeof convertToAmazonFormat>[number]

export async function buyAmazonLabel(
  companyId: string,
  shipmentId: string,
  token: string,
  body: AmazonBuyShippingPayload,
) {
  try {
    const { data } = await http.request<BuyAmazonLabelResponse>({
      method: "POST",
      url: "https://sandbox.sellingpartnerapi-eu.amazon.com/shipping/v2/shipments",
      headers: {
        "x-amz-access-token": token,
        "x-amzn-shipping-business-id": "AmazonShipping_UK",
      },
      data: body.amazonPayload,
    })

    const labelLink = await uploadToS3(
      companyId,
      shipmentId,
      body.orderId,
      `data:application/pdf;base64,${data.payload.packageDocumentDetails[0].packageDocuments[0].contents}`,
    )

    const trackingNumber = data.payload.packageDocumentDetails[0].trackingId.toString()

    updateOrderService(body.orderId, {
      labelLink: labelLink,
      status: "SUCCESS",
      trackingNumber,
    })

    return { labelLink, trackingNumber }
  } catch (error) {
    if (error instanceof XiorError) {
      await updateOrderService(body.orderId, {
        status: "FAILED",
        failureReasons: error.response?.data,
      })
      throw error.response?.data
    }
  }
}

export async function amazonMQWorker(shipment: Shipment) {
  const payloads = convertToAmazonFormat(shipment)
  const { refreshToken } = AmazonCredentialsSchema.parse(shipment.carrier.credentials)

  const token = await verifyAmazonCredentials(refreshToken)

  if (!token) throw new HTTPException(400, { message: "No token found" })

  const childJobs = payloads.map((payload) => ({
    payload: payload,
    token: token.access_token,
    companyId: shipment.companyId,
    shipmentId: shipment.id,
  }))

  const jobs = await createAmazonBatchFlow(shipment.id, childJobs)

  return jobs
}

export async function buyOneAmazonShippingWorker(shipment: Shipment) {
  const payloads = convertToAmazonFormat(shipment)
  const { refreshToken } = AmazonCredentialsSchema.parse(shipment.carrier.credentials)

  const token = await verifyAmazonCredentials(refreshToken)

  if (!token) throw new HTTPException(400, { message: "No token found" })

  const res = await buyAmazonLabel(
    shipment.companyId,
    shipment.id,
    token.access_token,
    payloads[0],
  )

  return res?.labelLink || ""
}
