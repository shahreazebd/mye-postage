import { CountryCode2LetterSchema } from "@/lib/schema-constants"
import * as z from "zod"

export const AmazonCarrierMetadataSchema = z.object({
  storeId: z.string().min(1, "Store Id is required"),
})

export const AmazonCredentialsSchema = z.object({
  refreshToken: z.string().min(1, "Refresh Token is required"),
})

const WeightSchema = z.object({
  unit: z.enum(["GRAM", "KILOGRAM", "OUNCE", "POUND"]),
  value: z.number(),
})

const ItemSchema = z.object({
  quantity: z.number(),
  itemIdentifier: z.string(),
  description: z.string(),
  isHazmat: z.boolean(),
  weight: WeightSchema,
})

const ShipSchema = z.object({
  name: z.string().min(1).max(50),
  addressLine1: z.string().min(1).max(60),
  stateOrRegion: z.string(),
  postalCode: z.string(),
  city: z.string(),
  countryCode: CountryCode2LetterSchema,
  email: z.string().email().max(64),
  phoneNumber: z.string().min(1).max(20),
  addressLine2: z.string().max(60).optional(),
})

const ChannelDetailsSchema = z.object({
  channelType: z.enum(["AMAZON", "EXTERNAL"]),
  amazonOrderDetails: z.object({
    orderId: z.string(),
  }),
})

const PackageSchema = z.object({
  dimensions: z.object({
    length: z.number(),
    width: z.number(),
    height: z.number(),
    unit: z.enum(["INCH", "CENTIMETER"]),
  }),
  weight: WeightSchema,
  items: z.array(ItemSchema),
  insuredValue: z.object({
    unit: z.string(),
    value: z.number(),
  }),
  packageClientReferenceId: z.string(),
})

export const AmazonRatePayloadSchema = z.object({
  storeId: z.string(),
  shipTo: ShipSchema,
  packages: z.array(PackageSchema),
  channelDetails: ChannelDetailsSchema,
})

export const AmazonRateBulkPayloadSchema = z.object({
  storeId: z.string(),
  data: z.array(
    AmazonRatePayloadSchema.pick({
      shipTo: true,
      packages: true,
      channelDetails: true,
    }),
  ),
})
