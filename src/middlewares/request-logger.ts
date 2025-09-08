import { logger } from "@/lib/logger"
import type { MiddlewareHandler } from "hono"

export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now()

  await next()

  const duration = Date.now() - start
  const req = c.req
  const res = c.res

  const ip = req.header("x-forwarded-for") || req.header("cf-connecting-ip") || "unknown"
  logger.info(`${ip} ${req.method} ${req.path} -> ${res.status} in ${duration}ms`)
}
