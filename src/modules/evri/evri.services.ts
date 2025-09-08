import xior, { XiorError } from "xior"
import z from "zod"

import { carriersConfig } from "@/configs/carriers.config"
import { ApiError } from "@/lib/api-error"
import { env } from "@/lib/env"
import { CountryCode3LetterSchema, CurrencyCodeSchema } from "@/lib/schema-constants"
import { splitFullName } from "@/lib/utils"
import type { Shipment } from "@/modules/shipments/shipments.schemas"
import { uploadToS3 } from "@/modules/utils/utils.services"
import { updateOrderService } from "../orders/orders.services"
import { EvriCredentialsSchema } from "./evri.schemas"
import { createEvriBatchFlow } from "./evri.workers"

export function evriOauthRedirect(clientId: string, carrierId: string) {
  const redirectURI =
    env.NODE_ENV === "production"
      ? `http://localhost:9099/oauth/evri/callback?state=${carrierId}`
      : `http://localhost:9099/oauth/evri/callback?state=${carrierId}`

  const hardcodeURI = "https://localhost:8080"

  return `https://www.myhermes.co.uk/customer/authorize?response_type=code&client_id=${clientId}&redirect_uri=${hardcodeURI}`
}

export async function getTokenFromEvri({
  clientId,
  clientSecret,
  code,
}: { clientId: string; clientSecret: string; code: string }) {
  try {
    const { data } = await xior.request<{
      access_token: string
      expires_in: number
      token_type: string
    }>({
      method: "POST",
      url: `${carriersConfig.evri.apiUrl}/oauth/token`,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      data: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        scope: "all",
      }),
    })

    return data
  } catch (error) {
    if (error instanceof XiorError) {
      console.error(
        "Failed to get token from Evri:",
        error?.response?.data || error.message,
      )
    }

    return null
  }
}

export type EvriParcelPayload = ReturnType<typeof convertToEvriFormat>[number]

const EvriParcelPayloadSchema = z.object({
  carrier: z.object({
    shipperName: z.string().max(200).optional().default(""),
    shipperEmail: z.string().email().max(254).optional().default(""),
    shipperPhone: z.string().max(25),
  }),
  orders: z.array(
    z.object({
      id: z.string().max(50).optional(),
      marketplaceOrderId: z.string().max(40),
      modifiedSku: z.string(),
      address: z.object({
        buyerName: z.string().max(210),
        addressLine1: z.string().min(1).max(100),
        addressLine2: z.string().max(100).optional(),
        city: z.string().min(1).max(100),
        country: z.string().max(100),
        postCode: z.string().max(20),
        countryCode: CountryCode3LetterSchema,
        phone: z.string().nonempty().max(25),
        email: z.string().email().max(254),
      }),
      items: z.array(
        z.object({
          unitWeightInGrams: z.number().nonnegative().int(),
          name: z.string().max(800),
          localSku: z.string().max(100),
          quantity: z.number().int(),
          marketplaceSku: z.string().max(100),
          // unitValue: z.string(),
        }),
      ),
      purchaseDate: z.coerce.date().default(new Date()),
      currency: CurrencyCodeSchema,
      metadata: z.object({
        deliveryInstructions: z.string().optional(),
        nextDay: z.boolean().optional(),
      }),
    }),
  ),
  metadata: z.object({
    deliveryInstructions: z.string().optional(),
    nextDay: z.boolean(),
  }),
})

export function validateEvriShipmentPayload(shipment: Shipment) {
  return EvriParcelPayloadSchema.parse(shipment)
}

function convertToEvriFormat(shipment: Shipment) {
  const { orders, metadata } = validateEvriShipmentPayload(shipment)

  const evriConvertedPayload = orders.map((order) => {
    const totalWeightInGrams = order.items.reduce(
      (sum, item) => sum + (item.unitWeightInGrams || 0),
      0,
    )
    const totalWeightInKg = totalWeightInGrams / 1000

    const { firstName, lastName } = splitFullName(order.address.buyerName)

    const payload = {
      clientUID: order.marketplaceOrderId,
      parcelDetails: {
        weightKg: totalWeightInKg,
        itemDescription: "clothing",
        deliveryReference: order.modifiedSku.slice(0, 20),
        estimatedParcelValuePounds: 200, // need to change
        // compensationRequiredPounds: 0,
        type: "STANDARD",
      },
      deliveryDetails: {
        deliveryAddress: {
          line1: order.address.addressLine1.slice(0, 32),
          line2: order.address.addressLine2?.slice(0, 32),
          line3: `${order.address.city}, ${order.address.postCode}`,
          line4: order.address.countryCode,
          postcode: order.address.postCode,
        },
        firstName: firstName,
        lastName: lastName,
        email: order.address.email,
        telephone: order.address.phone,
        signatureRequired: false,
        deliveryInstructions:
          order.metadata?.deliveryInstructions ||
          metadata.deliveryInstructions ||
          "no instructions",
        // deliverySafePlace: "string",
        nextDay: order.metadata?.nextDay || metadata.nextDay,
      },
    }

    return {
      evriPayload: payload,
      orderId: order.id,
      marketPlaceOrderId: order.marketplaceOrderId,
    }
  })

  return evriConvertedPayload
}

export type EvriParcelResponse = {
  parcelSummaries: ParcelSummary[]
}

export type ParcelSummary = {
  clientUID: string
  barcode: string
  status: string
  errors: Error[]
}

export type Error = {
  error_paths: string[]
  error: string
  error_description: string
}
export async function createEvriShipment(
  companyId: string,
  shipmentId: string,
  accessToken: string,
  body: EvriParcelPayload,
) {
  try {
    const { data } = await xior.request<EvriParcelResponse>({
      method: "post",
      url: "https://api.myhermes.co.uk/api/parcels",
      data: {
        parcels: body.evriPayload,
      },
      headers: {
        "Content-Type": "application/vnd.myhermes.parcels-v1+json",
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.myhermes.parcelsummaries-v1+json",
      },
    })

    const barcode = data.parcelSummaries[0].barcode
    const status = data.parcelSummaries[0].status

    const label = getLabelFromEvri(barcode, accessToken)

    // const trackingNumber = data.trackingNumber || "track-1234"
    // const b64 = `data:application/pdf;base64,${createdOrder.label}`

    // const labelLink = await uploadToS3(companyId, shipmentId, body.orderId as string, b64)

    // await updateOrderService(body.orderId as string, {
    //   labelLink: labelLink,
    //   status: "SUCCESS",
    //   trackingNumber,
    // })

    // return { trackingNumber, labelLink }
  } catch (error) {
    if (error instanceof XiorError) {
      await updateOrderService(body.orderId as string, {
        status: "FAILED",
        failureReasons: error.response?.data,
      })
      throw error.response?.data
    }

    if (error instanceof ApiError) {
      await updateOrderService(body.orderId as string, {
        status: "FAILED",
        failureReasons: {
          status: error.statusCode,
          message: error.message,
          meta: error.meta,
        },
      })
    }

    throw error
  }
}

export async function getLabelFromEvri(barcode: string, accessToken: string) {
  try {
    const response = await xior.request<string>({
      method: "get",
      url: `${carriersConfig.evri.apiUrl}/api/labels/${barcode}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/pdf; base64=true",
      },
      params: { format: "THERMAL" },
      timeout: 60 * 1000, // 60 secs
    })

    return response.data
  } catch (error) {
    if (error instanceof XiorError) {
      console.error(error.message)
    }
    return null
  }
}

export async function evriMQWorker(shipment: Shipment) {
  const payloads = convertToEvriFormat(shipment)

  const credentials = EvriCredentialsSchema.parse(shipment.carrier.credentials)

  if (!credentials.code) {
    throw new ApiError(400, "No code found")
  }

  const creds = await getTokenFromEvri({
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
    code: credentials.code,
  })

  if (!creds?.access_token) {
    throw new ApiError(401, "No access token")
  }

  const childJobs = payloads.map((payload) => ({
    payload: payload,
    token: creds.access_token,
    companyId: shipment.companyId,
    shipmentId: shipment.id,
  }))

  const jobs = await createEvriBatchFlow(shipment.id, childJobs)

  return jobs
}
