import PQueue from "p-queue"
import z from "zod"

import { ApiError } from "@/lib/api-error"
import type { AppRouteHandler } from "@/lib/types"
import { prisma } from "prisma"
import { AmazonCreateShipmentSchema } from "../shipments/shipments.schemas"
import type {
  CreateAmazonShipmentRoute,
  FetchAmazonRatesBulkRoute,
  FetchAmazonRatesRoute,
  GetAmazonTokenRoute,
} from "./amazon.routes"
import { AmazonCredentialsSchema } from "./amazon.schemas"
import { getAmazonShippingRates, verifyAmazonCredentials } from "./amazon.services"

export const getAmazonToken: AppRouteHandler<GetAmazonTokenRoute> = async (c) => {
  const { refreshToken } = c.req.valid("json")

  const creds = await verifyAmazonCredentials(refreshToken)

  if (!creds) {
    throw new ApiError(401, "Invalid credentials")
  }

  return c.json({ success: true, data: creds }, 200)
}

export const fetchAmazonRates: AppRouteHandler<FetchAmazonRatesRoute> = async (c) => {
  const { storeId, ...restBody } = c.req.valid("json")

  const carrier = await prisma.carrier.findFirst({
    where: {
      metadata: {
        path: ["storeId"],
        equals: storeId,
      },
    },
  })

  if (!carrier) {
    throw new ApiError(404, "Carrier Not Found")
  }

  const shipFrom = {
    name: carrier.shipperName,
    addressLine1: carrier.addressLine1,
    stateOrRegion: carrier.stateOrProvinceCode,
    postalCode: carrier.postalCode,
    city: carrier.city,
    countryCode: carrier.countryCode,
    email: carrier.shipperEmail,
    phoneNumber: carrier.shipperPhone,
  }

  const amazonCreds = AmazonCredentialsSchema.parse(carrier.credentials)

  if (!amazonCreds.refreshToken) {
    throw new ApiError(400, "Amazon credentials not found")
  }

  const res = await getAmazonShippingRates(amazonCreds.refreshToken, {
    ...restBody,
    shipFrom,
  })

  if (!res) {
    throw new ApiError(400, "Cant find rates")
  }

  return c.json({ success: true, data: res.payload }, 200)
}

export const fetchAmazonRatesBulk: AppRouteHandler<FetchAmazonRatesBulkRoute> = async (
  c,
) => {
  const { storeId, data } = c.req.valid("json")

  const carrier = await prisma.carrier.findFirst({
    where: { metadata: { path: ["storeId"], equals: storeId } },
  })

  if (!carrier) {
    throw new ApiError(404, "Carrier Not Found")
  }

  const shipFrom = {
    name: carrier.shipperName,
    addressLine1: carrier.addressLine1,
    stateOrRegion: carrier.stateOrProvinceCode,
    postalCode: carrier.postalCode,
    city: carrier.city,
    countryCode: carrier.countryCode,
    email: carrier.shipperEmail,
    phoneNumber: carrier.shipperPhone,
  }

  const amazonCreds = AmazonCredentialsSchema.parse(carrier.credentials)

  if (!amazonCreds.refreshToken) {
    throw new ApiError(400, "Amazon credentials not found")
  }

  // Use a queue to limit the number of concurrent requests
  const queue = new PQueue({ intervalCap: 5, interval: 1000 })

  const tasks = []

  for (const item of data) {
    tasks.push(
      queue.add(() =>
        getAmazonShippingRates(amazonCreds.refreshToken, {
          ...item,
          shipFrom,
        }),
      ),
    )
  }

  console.log(tasks)

  // Wait for all tasks to complete
  const response = await Promise.allSettled(tasks)

  const result = response.map((res) => {
    if (res.status === "fulfilled") {
      return { status: "success", ...res.value?.payload }
    }
    return { status: "error", error: res.reason }
  })

  return c.json({ success: true, data: result }, 200)
}

export const createAmazonShipments: AppRouteHandler<CreateAmazonShipmentRoute> = async (
  c,
) => {
  const data = c.req.valid("json")
  const jwtPayload = c.get("jwtPayload")

  const existingCarrier = await prisma.carrier.findUnique({
    where: { id: data.carrierId, type: "AMAZON" },
  })

  if (!existingCarrier) {
    return c.json({ success: false, message: "Carrier not found" }, 404)
  }

  const { orders, ...shippings } = data

  const result = await prisma.shipment.create({
    data: {
      ...shippings,
      carrierType: "AMAZON",
      companyId: jwtPayload.companyId,
      createdBy: jwtPayload.id,

      orders: { create: orders },
    },
    include: { carrier: true, orders: true },
  })

  return c.json(
    {
      success: true,
      data: AmazonCreateShipmentSchema.extend({ id: z.string() }).parse(result),
    },
    201,
  )
}
