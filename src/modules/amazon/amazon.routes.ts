import { NotFoundSchema } from "@/lib/schema-constants"
import { createRoute, z } from "@hono/zod-openapi"
import { createErrorSchema } from "stoker/openapi/schemas"
import {
  AmazonCreateShipmentSchema,
  CreateShipmentSchema,
} from "../shipments/shipments.schemas"
import { AmazonRateBulkPayloadSchema, AmazonRatePayloadSchema } from "./amazon.schemas"

const tags = ["Amazon"]

export const getAmazonToken = createRoute({
  tags,
  method: "post",
  path: "/amazon/token",
  summary: "Obtain Amazon OAuth Access Token",
  description:
    "Exchange a valid Amazon refresh token for a new OAuth access token. This endpoint is used to authenticate your postage system with Amazon APIs. The returned token can be used for subsequent Amazon API requests.",
  request: {
    body: {
      description: "Amazon refresh token credentials for authentication.",
      content: {
        "application/json": {
          schema: z.object({
            refreshToken: z
              .string()
              .describe("The Amazon refresh token issued to your application."),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Amazon OAuth token successfully retrieved.",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().describe("Indicates if the operation was successful."),
            data: z.any().describe("The Amazon OAuth token response data."),
          }),
        },
      },
    },

    401: {
      description: "Authentication failed. Invalid or expired refresh token.",
      content: {
        "application/json": {
          schema: createErrorSchema(z.object({ message: z.string() })),
        },
      },
    },
    422: {
      description: "Invalid request body. Required fields are missing or malformed.",
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

export const fetchAmazonRates = createRoute({
  tags,
  method: "post",
  path: "/amazon/rates",
  summary: "Retrieve Amazon Shipping Rates",
  description:
    "Fetch available shipping options and their costs from Amazon Shipping. " +
    "This endpoint requires valid Amazon authentication credentials and a properly formatted request body. " +
    "It returns a list of shipping services, rates, and estimated delivery times for the provided shipment details. " +
    "Use this endpoint to display shipping options to your customers or to select the most suitable shipping service for your needs.",
  request: {
    body: {
      description:
        "Shipment details and authentication credentials required to fetch Amazon shipping rates.",
      content: {
        "application/json": {
          schema: AmazonRatePayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Amazon shipping rates successfully retrieved.",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().describe("Indicates if the operation was successful."),
            data: z.any(),
          }),
        },
      },
    },
    401: {
      description: "Authentication failed. Invalid or expired Amazon credentials.",
      content: {
        "application/json": {
          schema: createErrorSchema(z.object({ message: z.string() })),
        },
      },
    },
    422: {
      description: "Invalid request body. Required fields are missing or malformed.",
      content: {
        "application/json": {
          schema: createErrorSchema(AmazonRatePayloadSchema),
        },
      },
    },
  },
})

export const fetchAmazonRatesBulk = createRoute({
  tags,
  method: "post",
  path: "/amazon/rates/bulk",
  summary: "Retrieve Amazon Shipping Rates in Bulk",
  description:
    "Fetch available shipping options and their costs from Amazon Shipping for multiple shipments in a single request. " +
    "This endpoint requires valid Amazon authentication credentials and a properly formatted request body. " +
    "It returns a list of shipping services, rates, and estimated delivery times for the provided shipment details. " +
    "Use this endpoint to display shipping options to your customers or to select the most suitable shipping service for your needs.",
  request: {
    body: {
      description:
        "Shipment details and authentication credentials required to fetch Amazon shipping rates.",
      content: {
        "application/json": {
          schema: AmazonRateBulkPayloadSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Amazon shipping rates successfully retrieved.",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().describe("Indicates if the operation was successful."),
            data: z.any(),
          }),
        },
      },
    },
    401: {
      description: "Authentication failed. Invalid or expired Amazon credentials.",
      content: {
        "application/json": {
          schema: createErrorSchema(z.object({ message: z.string() })),
        },
      },
    },
    422: {
      description: "Invalid request body. Required fields are missing or malformed.",
      content: {
        "application/json": {
          schema: createErrorSchema(AmazonRateBulkPayloadSchema),
        },
      },
    },
  },
})

export const createAmazonShipments = createRoute({
  tags,
  method: "post",
  path: "/amazon/shipments",
  summary: "Create a amazon shipment",
  description: "You can create shipments for amazon",
  request: {
    body: {
      description: "The shipment to create",
      content: {
        "application/json": {
          schema: AmazonCreateShipmentSchema,
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
            data: AmazonCreateShipmentSchema,
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

export type GetAmazonTokenRoute = typeof getAmazonToken
export type FetchAmazonRatesRoute = typeof fetchAmazonRates
export type FetchAmazonRatesBulkRoute = typeof fetchAmazonRatesBulk
export type CreateAmazonShipmentRoute = typeof createAmazonShipments
