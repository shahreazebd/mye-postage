import dotenv from "dotenv"
import { ZodError, z } from "zod"

dotenv.config()

const envSchema = z.object({
  // service
  DATABASE_URL: z.string().url(),
  TRUSTED_ORIGINS: z.string().transform((val) => val.split(",")),

  // s3
  BUCKET_NAME: z.string(),
  BUCKET_REGION: z.string(),
  STORAGE_ENDPOINT: z.string().url(),
  STORAGE_ACCESS_KEY: z.string(),
  STORAGE_SECRET_KEY: z.string(),

  // dhl
  DHL_CLIENT_ID: z.string(),
  DHL_CLIENT_SECRET: z.string(),

  // amazon
  LWA_APP_ID: z.string(),
  LWA_CLIENT_SECRET: z.string(),

  // redis
  REDIS_HOST: z.string().nonempty(),
  REDIS_PORT: z.coerce.number().int().min(1).max(65535),
  REDIS_USERNAME: z.string().nonempty(),
  REDIS_PASSWORD: z.string().nonempty(),
  REDIS_DB: z.coerce.number().int().min(0),

  // optionals
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  PORT: z.coerce.number().default(9099),
  JWKS_URI: z.string().optional(),
})

export let env: z.infer<typeof envSchema>

try {
  env = envSchema.parse(process.env)
} catch (error) {
  if (error instanceof ZodError) {
    console.error("Invalid env")
    console.error(error.flatten().fieldErrors)

    process.exit(1)
  }
}
