import z from "zod"

export const FedexTrackingSchema = z.object({
  trackingNumber: z.string().nonempty(),
  carrierId: z.string().nonempty(),
})
