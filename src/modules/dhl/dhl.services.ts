import pLimit from "p-limit"
import { XiorError } from "xior"

import { carriersConfig } from "@/configs/carriers.config"
import { ApiError } from "@/lib/api-error"
import { env } from "@/lib/env"
import { http } from "@/lib/xior"
import type { Shipment } from "@/modules/shipments/shipments.schemas"
import { uploadToS3 } from "@/modules/utils/utils.services"
import { updateOrderService } from "../orders/orders.services"
import { createDHLBatchFlow } from "./dhl.workers"

export type DHLPayload = ReturnType<typeof convertToDHLFormat>[number]

export function convertToDHLFormat(payload: Shipment) {
  const shipper = {
    name1: payload?.carrier?.shipperName,
    addressStreet: payload?.carrier?.addressLine1,
    postalCode: payload?.carrier?.postalCode,
    city: payload?.carrier?.city,
    country: payload?.carrier?.countryCode || "DEU",
    email: payload?.carrier?.shipperEmail,
    phone: payload?.carrier?.shipperPhone,
  }

  const dhlShippingPayload = payload.orders.map((order) => {
    const totalWeight = order.items?.reduce(
      (sum, item) => sum + (item.unitWeightInGrams || 0),
      0,
    )

    const dhlPayload = {
      product: "V01PAK",
      billingNumber: payload.carrier.metadata?.billingNumber, // required example=33333333330101
      refNo: order.marketplaceOrderId.slice(0, 35), // max=35 min=8
      shipper,
      consignee: {
        name1: order.address.buyerName,
        addressStreet: order.address.addressLine1,
        postalCode: order.address.postCode,
        city: order.address.city,
        country: order.address.countryCode, //required valid 3 chars country code
        email: order.address.email,
        phone: order.address.phone,
      },
      details: {
        dim: {
          uom: "mm", // required val=[mm, cm]
          height: 100, // required
          length: 200, // required
          width: 150, // required
        },
        weight: {
          uom: "g", // required val=[g, kg]
          value: totalWeight, // required min=0 max=31500
        },
      },
    }

    return {
      dhlPayload,
      orderId: order.id,
      marketPlaceOrderId: order.marketplaceOrderId,
    }
  })

  return dhlShippingPayload
}

export async function verifyDHLCredentials(username = "", password = "") {
  const params = new URLSearchParams({
    grant_type: "password",
    username: username,
    password: password,
    client_id: env.DHL_CLIENT_ID,
    client_secret: env.DHL_CLIENT_SECRET,
  })

  const url = `${carriersConfig.dhl.apiUrl}/parcel/de/account/auth/ropc/v1/token`

  try {
    const res = await http.post(url, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    return res.data?.access_token
  } catch (err: unknown) {
    if (err instanceof XiorError) {
      throw new ApiError(
        err.response?.status || 500,
        err?.response?.statusText || "Unknown error",
        err?.response?.data,
      )
    }
    throw new ApiError(500, "Fedex authentication failed", { error: err })
  }
}

async function validateDHLShipment(
  token: string,
  body: ReturnType<typeof convertToDHLFormat>[number],
) {
  try {
    const payload = {
      profile: "STANDARD_GRUPPENPROFIL",
      shipments: [body.dhlPayload],
    }

    const url = `${carriersConfig.dhl.apiUrl}/parcel/de/shipping/v2/orders?validate=true`

    const { status } = await http.post(url, payload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return { success: true, status, orderId: body.marketPlaceOrderId }
  } catch (error) {
    if (error instanceof XiorError) {
      throw { error: error.response?.data, orderId: body.marketPlaceOrderId }
    }
  }
}

export async function createDHLShipmentSandbox(
  companyId: string,
  shipmentId: string,
  token: string,
  body: ReturnType<typeof convertToDHLFormat>[number],
) {
  try {
    const payload = {
      profile: "STANDARD_GRUPPENPROFIL",
      shipments: [body.dhlPayload],
    }

    const url = `${carriersConfig.dhl.apiUrl}/parcel/de/shipping/v2/orders`

    const res = await http.post(url, payload, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })

    console.log(JSON.stringify(res.data, null, 2))

    const trackingNumber = res?.data?.items[0]?.shipmentNo
    const b64 = `data:application/pdf;base64,${res?.data?.items[0]?.label?.b64}`

    const labelLink = await uploadToS3(companyId, shipmentId, body.orderId, b64)

    await updateOrderService(body.orderId, {
      labelLink: labelLink,
      status: "SUCCESS",
      trackingNumber,
    })

    return { trackingNumber, labelLink }
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

export async function dhlValidateWorker(shipment: Shipment) {
  const payloads = convertToDHLFormat(shipment)

  const { username = "", password = "" } = shipment.carrier.credentials || {}

  const token = await verifyDHLCredentials(username, password)
  console.log(token)

  const DHL_CONCURRENCY = 5
  const limit = pLimit(DHL_CONCURRENCY)

  const tasks: Promise<unknown>[] = []

  for (const p of payloads) {
    tasks.push(limit(() => validateDHLShipment(token, p)))
  }

  const results = await Promise.allSettled(tasks)

  const successCount = results.filter((r) => r.status === "fulfilled").length
  const failCount = results.length - successCount

  return { successCount, failCount, results }
}

export async function dhlMQWorker(shipment: Shipment) {
  const payloads = convertToDHLFormat(shipment)

  const { username = "", password = "" } = shipment.carrier.credentials || {}

  const token = await verifyDHLCredentials(username, password)

  const childJobs = payloads.map((payload) => ({
    payload: payload,
    token: token,
    companyId: shipment.companyId,
    shipmentId: shipment.id,
  }))

  const res = await createDHLBatchFlow(shipment.id, childJobs)

  return res
}

export async function buyOneDHLShippingWorker(shipment: Shipment) {
  const payloads = convertToDHLFormat(shipment)

  const { username = "", password = "" } = shipment.carrier.credentials || {}

  const token = await verifyDHLCredentials(username, password)

  const res = await createDHLShipmentSandbox(
    shipment.companyId,
    shipment.id,
    token,
    payloads[0],
  )

  return res?.labelLink || ""
}
