import { createRoute, z } from "@hono/zod-openapi"
import { createErrorSchema } from "stoker/openapi/schemas"

import { NotFoundSchema } from "@/lib/schema-constants"
import { CreateShipmentSchema } from "../shipments/shipments.schemas"

const tags = ["Royalmail"]

export const royalmailShipments = createRoute({
  tags,
  method: "post",
  path: "/royal-mail/shipments",
  summary: "Create a royal mail shipment",
  description: "You can create shipments for royal mail",
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
    400: {
      description: "bad request",
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

export const getRoyalmailValidPackaging = createRoute({
  tags,
  method: "get",
  path: "/royal-mail/packages",
  summary: "Get royal mail valid packaging",
  description: "You can retrieve valid packaging for royal mail",
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            packages: z.array(z.any()),
          }),
        },
      },
    },
  },
})

export type RoyalmailShipmentsRoute = typeof royalmailShipments
export type GetRoyalmailValidPackagingRoute = typeof getRoyalmailValidPackaging
