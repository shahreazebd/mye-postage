import { prisma } from "prisma"

import type { AppRouteHandler } from "@/lib/types"
import { verifyDHLCredentials } from "@/modules/dhl/dhl.services"
import { verifyFedexCredentials } from "@/modules/fedex/fedex.services"
import { DHLCredentialsSchema } from "../dhl/dhl.schemas"
import { EvriCredentialsSchema } from "../evri/evri.schemas"
import { evriOauthRedirect } from "../evri/evri.services"
import { FedExCredentialsSchema } from "../fedex/fedex.schemas"
import { RoyalmailCredentialsSchema } from "../royalmail/royalmail.schemas"
import type {
  CreateRoute,
  GetOneRoute,
  ListRoute,
  RemoveRoute,
  ToggleDefaultRoute,
  UpdateRoute,
} from "./carriers.routes"
import { AmazonCarrierSchema } from "./carriers.schemas"

export const create: AppRouteHandler<CreateRoute> = async (c) => {
  const data = c.req.valid("json")
  const { companyId, id: userId } = c.get("jwtPayload")

  if (data.type === "FEDEX") {
    const creds = FedExCredentialsSchema.parse(data.credentials)

    await verifyFedexCredentials(creds.clientId, creds.clientSecret)
  }

  if (data.type === "DHL") {
    const creds = DHLCredentialsSchema.parse(data.credentials)

    await verifyDHLCredentials(creds.username, creds.password)
  }

  if (data.type === "ROYAL_MAIL") {
    RoyalmailCredentialsSchema.parse(data.credentials)
  }

  if (data.type === "AMAZON") {
    AmazonCarrierSchema.parse(data)
  }

  if (data.type === "EVRI") {
    EvriCredentialsSchema.parse(data.credentials)
  }

  const payload = { ...data, companyId, createdBy: userId }
  const carrier = await prisma.carrier.create({ data: payload })

  if (data.type === "EVRI") {
    const evriCredentials = EvriCredentialsSchema.parse(carrier.credentials)

    const redirectURI = evriOauthRedirect(evriCredentials.clientId, carrier.id)

    return c.json({ success: true, redirectURI, data: carrier }, 201)
  }

  return c.json({ success: true, data: carrier }, 201)
}

export const list: AppRouteHandler<ListRoute> = async (c) => {
  const { type } = c.req.valid("query")
  const { companyId } = c.get("jwtPayload")

  const carriers = await prisma.carrier.findMany({
    where: { companyId, type },
    orderBy: { createdAt: "desc" },
  })

  return c.json({ success: true, data: carriers }, 200)
}

export const getOne: AppRouteHandler<GetOneRoute> = async (c) => {
  const { id } = c.req.valid("param")
  const { companyId } = c.get("jwtPayload")

  const carrier = await prisma.carrier.findFirst({ where: { id, companyId } })

  if (!carrier) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  return c.json({ success: true, data: carrier }, 200)
}

export const update: AppRouteHandler<UpdateRoute> = async (c) => {
  const data = c.req.valid("json")
  const { id } = c.req.valid("param")
  const { companyId, id: userId } = c.get("jwtPayload")

  const existingCarrier = await prisma.carrier.findFirst({ where: { id, companyId } })

  if (!existingCarrier) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  if (
    data.type === "FEDEX" &&
    data.credentials?.clientId &&
    data.credentials.clientSecret
  ) {
    await verifyFedexCredentials(data.credentials.clientId, data.credentials.clientSecret)
  } else if (data.type === "DHL") {
    const { username = "", password = "" } = data.credentials || {}
    await verifyDHLCredentials(username, password)
  }

  const payload = { ...data, companyId, updatedBy: userId }
  const carrier = await prisma.carrier.update({ where: { id, companyId }, data: payload })

  return c.json({ success: true, data: carrier }, 200)
}

export const toggleDefault: AppRouteHandler<ToggleDefaultRoute> = async (c) => {
  const { id } = c.req.valid("param")
  const { companyId, id: userId } = c.get("jwtPayload")

  const existingCarrier = await prisma.carrier.findFirst({ where: { id, companyId } })

  if (!existingCarrier) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  if (existingCarrier.isDefault) {
    return c.json({ success: true, data: existingCarrier }, 200)
  }

  const [_, service] = await prisma.$transaction([
    prisma.carrier.updateMany({
      where: { companyId, isDefault: true, type: existingCarrier.type },
      data: { isDefault: false },
    }),
    prisma.carrier.update({
      where: { id },
      data: { isDefault: true, updatedBy: userId },
    }),
  ])

  return c.json({ success: true, data: service }, 200)
}

export const remove: AppRouteHandler<RemoveRoute> = async (c) => {
  const { id } = c.req.valid("param")
  const { companyId } = c.get("jwtPayload")

  const results = await prisma.carrier.delete({ where: { id, companyId } })

  if (!results) {
    return c.json({ success: false, message: "Not found" }, 404)
  }

  return c.json({ success: true, data: { id } }, 200)
}
