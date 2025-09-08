import { prisma } from "prisma"

import { ApiError } from "@/lib/api-error"
import type { AppRouteHandler } from "@/lib/types"
import { dhlValidateWorker, verifyDHLCredentials } from "@/modules/dhl/dhl.services"
import type { Shipment } from "../shipments/shipments.schemas"
import type { CreateDhlShipmentsRoute, GetDHLTokenRoute } from "./dhl.routes"

export const createDhlShipments: AppRouteHandler<CreateDhlShipmentsRoute> = async (c) => {
  const data = c.req.valid("json")
  const { companyId, id } = c.get("jwtPayload")

  const existingCarrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId, companyId, type: "DHL" },
  })

  if (!existingCarrier) {
    return c.json({ success: false, message: "Carrier not found" }, 404)
  }

  const shipment = { ...data, companyId, carrierType: "DHL", carrier: existingCarrier }

  const { failCount, results } = await dhlValidateWorker(shipment as Shipment)

  if (failCount) {
    return c.json(results, 422)
  }

  const { orders, ...shippings } = data

  const result = await prisma.shipment.create({
    data: {
      ...shippings,
      companyId,
      carrierType: "DHL",
      createdBy: id,
      orders: { create: orders },
    },
    include: { carrier: true, orders: true },
  })

  return c.json({ success: true, data: result }, 201)
}

export const getDHLToken: AppRouteHandler<GetDHLTokenRoute> = async (c) => {
  const { username, password } = c.req.valid("json")

  console.log(username, password)

  const token = await verifyDHLCredentials(username, password)

  if (!token) {
    throw new ApiError(401, "Invalid credentials")
  }

  return c.json({ success: true, data: { token } }, 200)
}
