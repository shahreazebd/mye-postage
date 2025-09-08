import { z } from "@hono/zod-openapi"
import xior from "xior"

import { carriersConfig } from "@/configs/carriers.config"
import { ApiError } from "@/lib/api-error"
import type { AppRouteHandler } from "@/lib/types"
import {
  convertToFedExRatesAndTransitTimeFormat,
  validateFedexShipmentWorker,
  verifyFedexCredentials,
} from "@/modules/fedex/fedex.services"
import { prisma } from "prisma"
import {
  CreateShipmentSchema,
  type Shipment,
  ShipmentSchema,
} from "../shipments/shipments.schemas"
import type {
  CreateFedexRatesAndTransitTimeRoute,
  CreateFedexShipmentRoute,
  CreateFedexTrackingRoute,
  GetFedexTokenRoute,
} from "./fedex.routes"

export const getFedexToken: AppRouteHandler<GetFedexTokenRoute> = async (c) => {
  const { clientId, clientSecret } = c.req.valid("json")

  const token = await verifyFedexCredentials(clientId, clientSecret)

  if (!token) {
    throw new ApiError(401, "Invalid credentials")
  }

  return c.json({ success: true, data: { token } }, 200)
}

export const createFedexShipments: AppRouteHandler<CreateFedexShipmentRoute> = async (
  c,
) => {
  const data = c.req.valid("json")
  const { companyId, id } = c.get("jwtPayload")

  const existingCarrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId, type: "FEDEX" },
  })

  if (!existingCarrier) {
    return c.json({ success: false, message: "Carrier not found" }, 404)
  }

  const shipment = { ...data, carrierType: "FEDEX", carrier: existingCarrier }

  const { failCount, results } = await validateFedexShipmentWorker(shipment as Shipment)

  if (failCount) {
    const data = results.map((result) => ({
      ...(result as PromiseRejectedResult).reason.error,
      marketPlaceOrderId: (result as PromiseRejectedResult).reason.marketPlaceOrderId,
    }))

    return c.json({ data }, 422)
  }

  const { orders, ...shippings } = data

  const result = await prisma.shipment.create({
    data: {
      ...shippings,
      carrierType: "FEDEX",
      companyId,
      createdBy: id,
      orders: { create: orders },
    },
    include: { carrier: true, orders: true },
  })

  return c.json(
    {
      success: true,
      data: CreateShipmentSchema.merge(z.object({ id: z.string() })).parse(result),
    },
    201,
  )
}

export const createFedexTrackings: AppRouteHandler<CreateFedexTrackingRoute> = async (
  c,
) => {
  const { carrierId, trackingNumber } = c.req.valid("json")

  const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } })

  if (!carrier) {
    throw new ApiError(404, "Service not found")
  }

  const creds = carrier.credentials as { clientId: string; clientSecret: string }

  const token = await verifyFedexCredentials(creds.clientId, creds.clientSecret)

  const response = await xior.post(
    `${carriersConfig.fedex.apiUrl}/track/v1/associatedshipments`,
    {
      masterTrackingNumberInfo: {
        trackingNumberInfo: {
          trackingNumber,
        },
      },
      associatedType: "STANDARD_MPS",
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  )

  return c.json({ success: true, data: response.data }, 200)
}

export const createFedexRatesAndTransitTime: AppRouteHandler<
  CreateFedexRatesAndTransitTimeRoute
> = async (c) => {
  const data = c.req.valid("json")
  const { companyId } = c.get("jwtPayload")

  const existingShipment = await prisma.shipment.findUnique({
    where: { id: data.shipmentId, companyId },
    include: { carrier: true, orders: { where: { id: data.orderId } } },
  })

  if (!existingShipment || !existingShipment?.orders?.length) {
    return c.json({ success: false, message: "Shipment not found or has no orders" }, 404)
  }

  const shipment = ShipmentSchema.parse(existingShipment)
  const payload = convertToFedExRatesAndTransitTimeFormat(shipment)

  const creds = existingShipment?.carrier?.credentials as {
    clientId: string
    clientSecret: string
  }

  const token = await verifyFedexCredentials(creds.clientId, creds.clientSecret)

  const response = await xior.post(
    `${carriersConfig.fedex.apiUrl}/rate/v1/rates/quotes`,
    payload,
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  )

  return c.json({ success: true, data: response?.data }, 200)
}
