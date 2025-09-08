import { redisClient } from "@/lib/redis"
import type { AppBindings } from "@/lib/types"
import dayjs from "dayjs"
import relativeTime from "dayjs/plugin/relativeTime"
import type { Context, MiddlewareHandler } from "hono"

dayjs.extend(relativeTime)

export interface RateLimitOptions {
  maxRequests: number
  windowSize: number // in seconds
  keyGenerator?: (c: Context<AppBindings>) => string
  message?: string
  headers?: boolean
}

/**
 * Predefined presets for rate limits
 */
export const rateLimitPresets = {
  royalmail: { maxRequests: 1, windowSize: 120 },
  strict: { maxRequests: 10, windowSize: 60 },
  moderate: { maxRequests: 100, windowSize: 60 },
  lenient: { maxRequests: 1000, windowSize: 3600 },
  api: { maxRequests: 1000, windowSize: 3600 },
  upload: { maxRequests: 5, windowSize: 60 },
  auth: { maxRequests: 5, windowSize: 900 },
} as const

/**
 * Distributed rate limiting middleware using Redis.
 */
export function rateLimitMiddleware(
  options: RateLimitOptions,
): MiddlewareHandler<AppBindings> {
  const {
    maxRequests,
    windowSize,
    keyGenerator = (c) => getClientIP(c),
    message = "Too many requests, please try again later.",
    headers = true,
  } = options

  return async (c, next) => {
    const ipKey = keyGenerator(c)
    const now = Date.now()
    const windowStart = Math.floor(now / (windowSize * 1000)) * (windowSize * 1000)
    const redisKey = `rate_limit:${ipKey}:${windowStart}`

    try {
      const current = await redisClient.get(redisKey)
      const currentCount = current ? Number.parseInt(current, 10) : 0
      const resetTime = windowStart + windowSize * 1000
      const retryAfterSec = Math.ceil((resetTime - now) / 1000)

      if (currentCount >= maxRequests) {
        if (headers) {
          c.header("X-RateLimit-Limit", maxRequests.toString())
          c.header("X-RateLimit-Remaining", "0")
          c.header("X-RateLimit-Reset", Math.ceil(resetTime / 1000).toString())
          c.header("Retry-After", retryAfterSec.toString())
        }

        return c.json(
          {
            success: false,
            error: {
              name: "RateLimitError",
              message,
              meta: {
                limit: maxRequests,
                remaining: 0,
                resetTimestamp: Math.ceil(resetTime / 1000),
                resetReadable: dayjs(resetTime).format("YYYY-MM-DD HH:mm:ss"),
                retryAfterSeconds: retryAfterSec,
                retryAfterReadable: `${dayjs(resetTime).fromNow(true)} later`,
              },
            },
          },
          429,
        )
      }

      // Increment counter and set expiry in Redis
      const pipeline = redisClient.pipeline()
      pipeline.incr(redisKey)
      pipeline.expire(redisKey, windowSize)
      await pipeline.exec()

      // Add response headers
      if (headers) {
        const newCount = currentCount + 1
        const remaining = Math.max(0, maxRequests - newCount)

        c.header("X-RateLimit-Limit", maxRequests.toString())
        c.header("X-RateLimit-Remaining", remaining.toString())
        c.header("X-RateLimit-Reset", Math.ceil(resetTime / 1000).toString())
      }

      await next()
    } catch (err) {
      console.error("Rate limiter Redis error:", err)
      await next() // fallback: allow request if Redis fails
    }
  }
}

/**
 * Get client IP address with common fallbacks
 */
function getClientIP(c: Context<AppBindings>): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("cf-connecting-ip") ||
    c.req.header("x-real-ip") ||
    c.req.header("x-client-ip") ||
    "unknown"
  )
}

/**
 * Create user-based rate limiter using JWT `id`
 */
export function createUserRateLimit(
  options: Omit<RateLimitOptions, "keyGenerator">,
): MiddlewareHandler<AppBindings> {
  return rateLimitMiddleware({
    ...options,
    keyGenerator: (c) => c.get("jwtPayload")?.id || getClientIP(c),
  })
}

/**
 * Create company-based rate limiter using JWT `companyId`
 */
export function createCompanyRateLimit(
  options: Omit<RateLimitOptions, "keyGenerator">,
): MiddlewareHandler<AppBindings> {
  return rateLimitMiddleware({
    ...options,
    keyGenerator: (c) => c.get("jwtPayload")?.companyId || getClientIP(c),
  })
}
