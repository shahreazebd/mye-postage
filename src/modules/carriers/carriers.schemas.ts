import { CarrierType, CredentialType } from "generated/prisma"
import { z } from "zod"
import {
  AmazonCarrierMetadataSchema,
  AmazonCredentialsSchema,
} from "../amazon/amazon.schemas"

const CredentialTypeEnum = z.nativeEnum(CredentialType)
export const CarrierTypeEnum = z.nativeEnum(CarrierType)

export const CarrierSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  type: CarrierTypeEnum,
  companyId: z.string().uuid(),
  shipperPhone: z.string().min(5),
  credentialType: CredentialTypeEnum,
  credentials: z.any(),
  isActive: z.boolean().default(true),
  isDefault: z.boolean().default(false),
  addressLine1: z.string().nullish(),
  addressLine2: z.string().nullish(),
  accountNumber: z.string().nullish(),
  shipperName: z.string().nullish(),
  shipperEmail: z.string().nullish(),
  countryCode: z.string().nullish(),
  city: z.string().nullish(),
  postalCode: z.string().nullish(),
  stateOrProvinceCode: z.string().nullish(),
  createdBy: z.string().nullish(),
  updatedBy: z.string().nullish(),
  metadata: z.any(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export const CreateCarrierSchema = CarrierSchema.extend({
  credentials: z.record(z.string(), z.any()),
}).omit({
  id: true,
  companyId: true,
  createdAt: true,
  updatedAt: true,
})

export const AmazonCarrierSchema = CreateCarrierSchema.extend({
  shipperName: z.string().min(1).max(50),
  addressLine1: z.string().min(1).max(60),
  addressLine2: z.string().min(1).max(60).optional(),
  countryCode: z.string().max(2),
  city: z.string(),
  postalCode: z.string().max(20),
  stateOrProvinceCode: z.string(),
  shipperEmail: z.string().email().max(64).optional(),
  shipperPhone: z.string().min(1).max(20).optional(),
  metadata: AmazonCarrierMetadataSchema,
  credentials: AmazonCredentialsSchema,
}).omit({ accountNumber: true })

export const UpdateCarrierSchema = CreateCarrierSchema.partial()
