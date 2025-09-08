import { z } from "zod"

import { ShipmentStatus } from "generated/prisma"
import { CarrierSchema, CarrierTypeEnum } from "../carriers/carriers.schemas"
import { CreateOrderSchema, MarketplaceEnum, OrderSchema } from "../orders/orders.schemas"

const ShipmentStatusEnum = z.nativeEnum(ShipmentStatus)

export const ShipmentSchema = z.object({
  id: z.string(),
  companyId: z.string(),
  storeId: z.string().min(1).max(100),
  storeName: z.string().min(1).max(200),
  carrierType: CarrierTypeEnum,
  marketplace: MarketplaceEnum,
  status: ShipmentStatusEnum.default("WAITING"),
  metadata: z.any().nullish(),
  batchLabelLink: z.string().nullish(),
  carrierId: z.string(),
  carrier: CarrierSchema,
  orders: z.array(OrderSchema),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Shipment = z.infer<typeof ShipmentSchema>

export const CreateShipmentSchema = ShipmentSchema.extend({
  orders: z.array(CreateOrderSchema),
}).omit({
  id: true,
  companyId: true,
  batchLabelLink: true,
  carrier: true,
  createdAt: true,
  updatedAt: true,
  carrierType: true,
})

export const ListShipmentSchema = ShipmentSchema.extend({
  orders: z.array(OrderSchema.pick({ labelLink: true })),
  carrier: CarrierSchema.pick({ name: true, type: true }).nullable(),
}).pick({
  id: true,
  marketplace: true,
  storeName: true,
  orders: true,
  carrier: true,
  status: true,
})

export const GetOneShipmentSchema = ShipmentSchema.extend({
  orders: z.array(OrderSchema.extend({ items: z.any() })),
  carrier: CarrierSchema.nullable(),
})

// amazon specific

export const AmazonOrderMetadataSchema = z.object({
  requestToken: z.string(),
  rateId: z.string(),
  requestedDocumentSpecification: z.object({
    format: z.enum(["PDF"]).describe("Document format, e.g., PDF"),
    size: z.object({
      width: z.number().describe("Width of the document"),
      length: z.number().describe("Length of the document"),
      unit: z.enum(["INCH"]).describe("Unit of measurement"),
    }),
    dpi: z.number().describe("Dots per inch (DPI) for the document"),
    pageLayout: z.enum(["DEFAULT"]).describe("Page layout option"),
    needFileJoining: z.boolean().describe("Whether files should be joined"),
    requestedDocumentTypes: z
      .array(z.enum(["LABEL"]))
      .describe("Types of documents requested"),
  }),
})

export const AmazonCreateShipmentSchema = CreateShipmentSchema.extend({
  orders: z.array(
    CreateOrderSchema.extend({
      ...CreateOrderSchema.shape,
      metadata: AmazonOrderMetadataSchema,
    }),
  ),
})
