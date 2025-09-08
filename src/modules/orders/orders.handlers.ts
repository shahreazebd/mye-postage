import { prisma } from "prisma"

import type { AppRouteHandler } from "@/lib/types"

import { buyOneAmazonShippingWorker } from "../amazon/amazon.services"
import { buyOneDHLShippingWorker } from "../dhl/dhl.services"
import { buyOneFedexShippingWorker } from "../fedex/fedex.services"
import { buyOneRoyalmailShippingWorker } from "../royalmail/royalmail.services"
import { ShipmentSchema } from "../shipments/shipments.schemas"
import type {
  BuyOneShippingRoute,
  CreateRoute,
  GetOneRoute,
  ListRoute,
  RemoveRoute,
  UpdateRoute,
} from "./orders.routes"
import { OrderListSchema, OrderSchema } from "./orders.schemas"

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const body = c.req.valid("json")

  const order = await prisma.order.create({ data: body })

  return c.json({ success: true, data: OrderSchema.parse(order) }, 201)
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { shipmentId } = c.req.valid("query")

  const orders = await prisma.order.findMany({
    where: { shipmentId },
  })

  return c.json({ success: true, data: OrderListSchema.parse(orders) }, 200)
}

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid("param")

  const order = await prisma.order.findFirst({ where: { id } })

  if (!order) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  return c.json({ success: true, data: OrderSchema.parse(order) }, 200)
}

export const update: AppRouteHandler<UpdateRoute> = async (c) => {
  const body = c.req.valid("json")
  const { companyId } = c.get("jwtPayload")

  const { id } = c.req.valid("param")

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { shipment: true },
  })

  if (!existingOrder) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  if (existingOrder.shipment.companyId !== companyId) {
    return c.json({ success: false, message: "Forbidden" }, 403)
  }

  const order = await prisma.order.update({ where: { id }, data: body })

  return c.json({ success: true, data: OrderSchema.parse(order) }, 200)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { companyId } = c.get("jwtPayload")

  const { id } = c.req.valid("param")

  const existingOrder = await prisma.order.findUnique({
    where: { id },
    include: { shipment: true },
  })

  if (!existingOrder) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  if (existingOrder.shipment.companyId !== companyId) {
    return c.json({ success: false, message: "Forbidden" }, 403)
  }

  await prisma.order.delete({ where: { id } })

  return c.json({ success: true, data: { id } }, 200)
}

export const buyOneShipping: AppRouteHandler<BuyOneShippingRoute> = async (c) => {
  const { companyId } = c.get("jwtPayload")

  const { id } = c.req.valid("param")

  const shipment = await prisma.shipment.findFirst({
    where: {
      orders: {
        some: { id },
      },
      companyId: companyId,
    },
    include: {
      carrier: true,
      orders: {
        where: { id },
        take: 1,
      },
    },
  })

  if (!shipment) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  let res = ""
  const parsedShipment = ShipmentSchema.parse(shipment)

  switch (shipment.carrier.type) {
    case "FEDEX":
      res = await buyOneFedexShippingWorker(parsedShipment)
      break
    case "DHL":
      res = await buyOneDHLShippingWorker(parsedShipment)
      break
    case "ROYAL_MAIL":
      res = await buyOneRoyalmailShippingWorker(parsedShipment)
      break

    case "AMAZON":
      res = await buyOneAmazonShippingWorker(parsedShipment)
      break

    default:
      break
  }

  return c.json({ success: true, data: res }, 200)
}
