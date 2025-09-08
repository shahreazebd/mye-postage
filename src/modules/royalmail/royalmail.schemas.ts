import z from "zod"

export const RoyalmailCredentialsSchema = z.object({
  authKey: z.string().min(1, "Auth Key is required"),
})
