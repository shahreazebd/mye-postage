import { prisma } from "prisma"

import type { AppRouteHandler } from "@/lib/types"
import { amazonMQWorker } from "../amazon/amazon.services"
import { dhlMQWorker } from "../dhl/dhl.services"
import { fedexMQWorker } from "../fedex/fedex.services"
import { royalmailMQWorker } from "../royalmail/royalmail.services"
import type {
  BuyShipmentRoute,
  CreateShipment,
  GetOneRoute,
  ListRoute,
  RemoveRoute,
  SalesReportRoute,
} from "./shipments.routes"
import { ShipmentSchema } from "./shipments.schemas"
import * as shipmentService from "./shipments.services"

export const create: AppRouteHandler<CreateShipment> = async (c) => {
  return c.json({ message: "Not Implemented" }, 501)
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { companyId } = c.get("jwtPayload")
  const { date, marketplace, storeId, carrierType } = c.req.valid("query")

  const data = await prisma.shipment.findMany({
    where: {
      companyId,
      marketplace,
      storeId,
      carrierType,
      ...(date && {
        createdAt: {
          gte: new Date(new Date(date).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(date).setHours(23, 59, 59, 999)),
        },
      }),
    },
    select: {
      id: true,
      marketplace: true,
      storeName: true,
      status: true,
      carrier: { select: { type: true, name: true } },
      orders: { select: { labelLink: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  return c.json({ success: true, data })
}

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid("param")
  const { companyId } = c.get("jwtPayload")

  const shipment = await prisma.shipment.findFirst({
    where: { id, companyId },
    include: {
      carrier: true,
      orders: true,
      _count: {
        select: { orders: true },
      },
    },
  })

  if (!shipment) {
    return c.json({ message: "Not found", success: false }, 404)
  }

  const parsedShipment = ShipmentSchema.parse(shipment)

  return c.json({ success: true, data: parsedShipment }, 200)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param")
  const { companyId } = c.get("jwtPayload")

  const results = await prisma.shipment.delete({ where: { id, companyId } })

  if (!results) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  return c.json({ success: true, data: { id } }, 200)
}

export const buyShipment: AppRouteHandler<BuyShipmentRoute> = async (c) => {
  const { shipmentId } = c.req.valid("param")
  const { companyId } = c.get("jwtPayload")

  const existingShipment = await prisma.shipment.findUnique({
    where: { id: shipmentId, companyId },
    include: { carrier: true, orders: { where: { labelLink: null } } },
  })

  if (!existingShipment || !existingShipment?.orders?.length) {
    return c.json({ success: false, message: "Shipment not found or has no orders" }, 404)
  }

  if (existingShipment.status === "SUCCESS") {
    return c.json({ success: false, message: "Already purchased" }, 400)
  }

  await prisma.shipment.update({
    where: { id: existingShipment.id },
    data: { status: "PROCESSING" },
  })

  switch (existingShipment.carrier.type) {
    case "DHL": {
      const response = await dhlMQWorker(ShipmentSchema.parse(existingShipment))
      return c.json({ success: true, data: response }, 200)
    }

    case "FEDEX": {
      const response = await fedexMQWorker(ShipmentSchema.parse(existingShipment))
      return c.json({ success: true, data: response }, 200)
    }

    case "ROYAL_MAIL": {
      const response = await royalmailMQWorker(ShipmentSchema.parse(existingShipment))
      return c.json({ success: true, data: response }, 200)
    }

    case "AMAZON": {
      const response = await amazonMQWorker(ShipmentSchema.parse(existingShipment))
      return c.json({ success: true, data: response }, 200)
    }

    default:
      return c.json({ success: false, message: "Unsupported carrier type" }, 400)
  }
}

export const generateSalesReport: AppRouteHandler<SalesReportRoute> = async (c) => {
  const { shipmentId } = c.req.valid("param")
  const { companyId } = c.get("jwtPayload")

  const existingShipment = await prisma.shipment.findUnique({
    where: { id: shipmentId, companyId },
    include: { carrier: true, orders: true },
  })

  if (!existingShipment) {
    return c.json({ success: false, message: "Shipment not found" }, 404)
  }
  const shipment = ShipmentSchema.parse(existingShipment)

  const data = shipmentService.generateSalesReport(shipment)

  return c.json({ success: true, data }, 200)
}
