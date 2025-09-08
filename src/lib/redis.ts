import IORedis from "ioredis"
import { env } from "./env"

export const redisClient = new IORedis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  username: env.REDIS_USERNAME,
  password: env.REDIS_PASSWORD,
  db: env.REDIS_DB,
  maxRetriesPerRequest: null,
  // tls: {},
})

async function _getAllQueuesFromRedis() {
  const keys = await redisClient.keys("bull:*:id")
  const queueNames = keys.map((k) => k.split(":")[1])
  return [...new Set(queueNames)]
}

export async function checkRedisConnection(): Promise<boolean> {
  try {
    const pong = await redisClient.ping()
    console.log(`Redis connected!: ${pong}`)
    return true
  } catch (error) {
    console.error("Redis connection failed:", error)
    return false
  }
}
