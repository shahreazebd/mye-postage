import { z } from "zod"

export const ConvertFileSchema = z.object({
  urls: z.string().url().array(),
  scale: z.coerce.number().max(2).default(1),
})

export const FindZPLSchema = ConvertFileSchema.omit({ scale: true })
export const ConvertPdfSchema = z.object({ html: z.string() })
export const UploadFileSchema = z.object({
  companyId: z.string().uuid(),
  batchId: z.string().nonempty(),
  orderId: z.string().nonempty(),
  base64: z.string().nonempty(),
})

export const ValidateAddressSchema = z
  .array(
    z.object({
      addressLine1: z.string().min(1),
      countryCode: z.string().min(1).max(2),
      addressLine2: z.string().optional(),
      city: z.string(),
      postalCode: z.string(),
    }),
  )
  .nonempty()

export type ValidateAddress = z.infer<typeof ValidateAddressSchema>
