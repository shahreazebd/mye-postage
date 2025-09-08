import { createRouter } from "@/lib/create-app"
import { checkRedisConnection } from "@/lib/redis"
import { createRoute, z } from "@hono/zod-openapi"
import { checkDbConnection } from "prisma"

export const index = createRouter()
  .openapi(
    createRoute({
      tags: ["Connection Status"],
      method: "get",
      path: "/",
      summary: "Health Check",
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                status: z.string(),
                timestamp: z.number().default(1752561320469),
              }),
            },
          },
          description: "Health Check API",
        },
      },
    }),
    (c) => {
      return c.json({ status: "OK", timestamp: Date.now() }, 200)
    },
  )
  .openapi(
    createRoute({
      tags: ["Connection Status"],
      method: "get",
      path: "/ready",
      summary: "Readiness Check",
      responses: {
        200: {
          content: {
            "application/json": {
              schema: z.object({
                status: z.boolean(),
                redisStatus: z.boolean(),
                dbStatus: z.boolean(),
              }),
            },
          },
          description: "Readiness Check API",
        },
      },
    }),
    async (c) => {
      const dbStatus = await checkDbConnection()
      const redisStatus = await checkRedisConnection()

      const status = dbStatus && redisStatus

      return c.json({ status, dbStatus, redisStatus }, 200)
    },
  )
