import { createRoute, z } from "@hono/zod-openapi"
import { createErrorSchema } from "stoker/openapi/schemas"

import { NotFoundSchema } from "@/lib/schema-constants"
import { CreateShipmentSchema } from "../shipments/shipments.schemas"

const tags = ["DHL"]

export const createDhlShipments = createRoute({
  tags,
  method: "post",
  path: "/dhl/shipments",
  summary: "Create a dhl shipment",
  description: "You can create shipments for dhl",
  request: {
    body: {
      description: "The shipment to create",
      content: {
        "application/json": {
          schema: CreateShipmentSchema,
        },
      },
    },
  },
  responses: {
    201: {
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
    404: {
      description: "not found",
      content: {
        "application/json": {
          schema: NotFoundSchema,
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(CreateShipmentSchema),
        },
      },
    },
  },
})

export const getDHLToken = createRoute({
  tags,
  method: "post",
  path: "/dhl/token",
  summary: "Get a DHL auth token",
  description: "You can get a DHL auth token for your postage system.",
  request: {
    body: {
      description: "The DHL credentials to authenticate",
      content: {
        "application/json": {
          schema: z.object({
            username: z.string(),
            password: z.string(),
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
              username: z.string(),
              password: z.string(),
            }),
          ),
        },
      },
    },
  },
})

export type GetDHLTokenRoute = typeof getDHLToken
export type CreateDhlShipmentsRoute = typeof createDhlShipments
