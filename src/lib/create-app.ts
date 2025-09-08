import { OpenAPIHono } from "@hono/zod-openapi"
import { cors } from "hono/cors"
import { jwk } from "hono/jwk"
import { serveEmojiFavicon } from "stoker/middlewares"
import { defaultHook } from "stoker/openapi"

import { some } from "hono/combine"

import type { AppBindings } from "@/lib/types"
import { checkCompanyId } from "@/middlewares/check-company-id"
import { requestLogger } from "@/middlewares/request-logger"
import { checkDbConnection } from "prisma"
import { onError } from "../middlewares/on-error"
import { env } from "./env"
import { checkRedisConnection } from "./redis"

export function createRouter() {
  return new OpenAPIHono<AppBindings>({ strict: false, defaultHook })
}

function auth() {
  if (!env.JWKS_URI) {
    return checkCompanyId()
  }

  return some(checkCompanyId(), jwk({ jwks_uri: env.JWKS_URI }))
}

export function createApp() {
  const app = createRouter()

  checkDbConnection()
  checkRedisConnection()

  app.use(
    cors({
      origin: env.TRUSTED_ORIGINS ?? "",
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      credentials: true,
    }),
  )

  app.use(serveEmojiFavicon("🔥"))
  app.use(requestLogger)
  app.use("/carriers/*", auth())
  app.use("/shipments/*", auth())
  app.use("/orders/*", auth())

  app.use("/royalmail/*", auth())
  app.use("/dhl/*", auth())
  app.use("/fedex/*", auth())
  app.use("/amazon/shipments", auth())
  app.notFound((c) => c.json({ message: `Not Found - ${c.req.path}` }, 404))
  app.onError(onError)

  return app
}
