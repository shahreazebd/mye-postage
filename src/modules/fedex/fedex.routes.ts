import { createRoute, z } from "@hono/zod-openapi"
import { createErrorSchema } from "stoker/openapi/schemas"

import { NotFoundSchema } from "@/lib/schema-constants"
import { CreateShipmentSchema } from "../shipments/shipments.schemas"
import { FedexTrackingSchema } from "../trackings/trackings.schemas"
import { FedexRatesAndTransitTimeSchema } from "./fedex.schemas"

const tags = ["Fedex"]

export const getFedexToken = createRoute({
  tags,
  method: "post",
  path: "/fedex/token",
  summary: "Get a fedex auth token",
  description: "You can get a FedEx auth token for your postage system.",
  request: {
    body: {
      description: "The FedEx credentials to authenticate",
      content: {
        "application/json": {
          schema: z.object({
            clientId: z.string(),
            clientSecret: z.string(),
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

export const createFedexShipments = createRoute({
  tags,
  method: "post",
  path: "/fedex/shipments",
  summary: "Create a fedex shipment",
  description: "You can create shipments for fedex",
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
            data: CreateShipmentSchema,
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
          schema: z.union([z.any(), createErrorSchema(CreateShipmentSchema)]),
        },
      },
    },
  },
})

export const createFedexTrackings = createRoute({
  tags,
  method: "post",
  path: "/fedex/trackings",
  summary: "Create a FedEx tracking",
  description: "You can create a FedEx tracking for your postage system.",
  request: {
    body: {
      description: "The FedEx tracking to create",
      content: {
        "application/json": {
          schema: FedexTrackingSchema,
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
    404: {
      description: "Not found",
      content: {
        "application/json": {
          schema: NotFoundSchema,
        },
      },
    },
    // 422: {
    //   description: "invalid body",
    //   content: {
    //     "application/json": {
    //       schema: createErrorSchema(FedexTrackingSchema),
    //     },
    //   },
    // },
  },
})

export const createFedexRatesAndTransitTime = createRoute({
  tags,
  method: "post",
  path: "/fedex/rates-and-transit-time",
  summary: "Get FedEx rates and transit time",
  description: "You can get FedEx rates and transit time for your postage system.",
  request: {
    body: {
      description: "The FedEx rates and transit time request",
      content: {
        "application/json": {
          schema: FedexRatesAndTransitTimeSchema,
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
    404: {
      description: "Not found",
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
          schema: createErrorSchema(FedexRatesAndTransitTimeSchema),
        },
      },
    },
  },
})

export type GetFedexTokenRoute = typeof getFedexToken
export type CreateFedexShipmentRoute = typeof createFedexShipments
export type CreateFedexTrackingRoute = typeof createFedexTrackings
export type CreateFedexRatesAndTransitTimeRoute = typeof createFedexRatesAndTransitTime
