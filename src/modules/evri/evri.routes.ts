import { createRoute, z } from "@hono/zod-openapi"
import { createErrorSchema } from "stoker/openapi/schemas"

const tags = ["Evri"]

export const getEvriToken = createRoute({
  tags,
  method: "post",
  path: "/evri/token",
  summary: "Get a Evri auth token",
  description: "You can get a Evri auth token for your postage system.",
  request: {
    body: {
      description: "The Evri credentials to authenticate",
      content: {
        "application/json": {
          schema: z.object({
            clientId: z.string(),
            clientSecret: z.string(),
            code: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.any(),
          }),
        },
      },
    },

    401: {
      description: "not found",
      content: {
        "application/json": {
          schema: createErrorSchema(z.object({ message: z.string() })),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(
            z.object({
              clientId: z.string(),
              clientSecret: z.string(),
            }),
          ),
        },
      },
    },
  },
})

export type GetEvriTokenRoute = typeof getEvriToken
