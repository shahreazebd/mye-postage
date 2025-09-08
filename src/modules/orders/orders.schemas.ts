import { z } from "zod"

import { DimensionUnit, Marketplace, OrderStatus, WeightUnit } from "generated/prisma"

export const MarketplaceEnum = z.nativeEnum(Marketplace)
export const OrderStatusEnum = z.nativeEnum(OrderStatus)
const DimensionUnitEnum = z.nativeEnum(DimensionUnit)
const WeightUnitEnum = z.nativeEnum(WeightUnit)

const AddressSchema = z.object({
  city: z.string(),
  email: z.string(),
  phone: z.string(),
  country: z.string(),
  addressLine1: z.string(),
  addressLine2: z.string().optional(),
  postCode: z.string(),
  buyerName: z.string(),
  countryCode: z.string(),
})

const ItemSchema = z.object({
  name: z.string(),
  localSku: z.string(),
  quantity: z.number(),
  unitPrice: z.number(),
  marketplaceSku: z.string(),
  positionItemId: z.string().nullable(),
  unitWeightInGrams: z.number(),
})

export const OrderSchema = z.object({
  id: z.string(),
  marketplaceOrderId: z.string().min(1).max(100),
  totalItems: z.number(),
  totalWeight: z.number(),
  weightUnit: WeightUnitEnum,
  dimensionUnit: DimensionUnitEnum,
  currency: z.string(),
  originalSku: z.string().min(1).max(200),
  modifiedSku: z.string().min(1).max(200),
  address: AddressSchema,
  purchaseDate: z.coerce.date().nullish(),
  mergedOrderIds: z.array(z.string()),
  shipmentId: z.string(),
  items: z.array(ItemSchema),
  status: OrderStatusEnum.default("PROCESSING"),
  labelLink: z.string().nullish(),
  trackingNumber: z.string().nullish(),
  carrierLabelId: z.string().nullish(),
  carrierReturnLabelId: z.string().nullish(),
  failureReasons: z.any().nullish(),
  trackingDescription: z.string().nullish(),
  trackingDeliveredAt: z.coerce.date().nullish(),
  trackingStatus: z.string().nullish(),
  metadata: z.any().nullish(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type Order = z.infer<typeof OrderSchema>

export const CreateOrderSchema = OrderSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  shipmentId: true,
})

export const UpdateOrderSchema = CreateOrderSchema.partial()
export type UpdateOrder = z.infer<typeof UpdateOrderSchema>

export const OrderListSchema = z.array(OrderSchema)
