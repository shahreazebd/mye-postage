import { prisma } from "prisma"

import type { AppRouteHandler } from "@/lib/types"
import type { Shipment } from "../shipments/shipments.schemas"
import type {
  GetRoyalmailValidPackagingRoute,
  RoyalmailShipmentsRoute,
} from "./royalmail.routes"
import { validateRoyalmailShipmentPayload } from "./royalmail.services"

export const royalmailShipments: AppRouteHandler<RoyalmailShipmentsRoute> = async (c) => {
  const data = c.req.valid("json")
  const { companyId, id } = c.get("jwtPayload") ?? {}

  const existingCarrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId, type: "ROYAL_MAIL" },
  })

  if (!existingCarrier) {
    return c.json({ success: false, message: "Carrier not found" }, 404)
  }

  const shipment = {
    ...data,
    companyId,
    carrierType: "ROYAL_MAIL",
    carrier: existingCarrier,
  }

  validateRoyalmailShipmentPayload(shipment as Shipment)

  const { orders, ...shippings } = data

  const result = await prisma.shipment.create({
    data: {
      ...shippings,
      companyId,
      carrierType: "ROYAL_MAIL",
      createdBy: id,
      orders: { create: orders },
    },
    include: { carrier: true, orders: true },
  })

  return c.json({ success: true, data: result }, 201)
}

export const getRoyalmailValidPackaging: AppRouteHandler<
  GetRoyalmailValidPackagingRoute
> = async (c) => {
  const packages = await Bun.file("src/data/validPackaging.json").json()

  return c.json({ success: true, packages }, 200)
}
