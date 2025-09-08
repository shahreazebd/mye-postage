import { env } from "@/lib/env"
import { S3Client } from "@aws-sdk/client-s3"

export const s3 = new S3Client({
  region: env.BUCKET_REGION,
  endpoint: env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
})
