import { IdParamsSchema, NotFoundSchema } from "@/lib/schema-constants"
import { JobInfoSchema } from "@/lib/utils"
import { createRoute, z } from "@hono/zod-openapi"
import { CarrierType, Marketplace } from "generated/prisma"
import { createErrorSchema } from "stoker/openapi/schemas"
import { GetOneShipmentSchema, ListShipmentSchema } from "./shipments.schemas"

const tags = ["Shipments"]

export const create = createRoute({
  tags,
  method: "post",
  path: "/shipments",
  summary: "Create a shipment",
  description: "You can create shipments for a user",
  request: {
    body: {
      description: "The shipment to create",
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
    },
  },
  responses: {
    501: {
      description: "Not implemented",
      content: {
        "application/json": {
          schema: z.object({
            message: z.string(),
          }),
        },
      },
    },
  },
})

export const list = createRoute({
  tags,
  method: "get",
  path: "/shipments",
  summary: "Get shipment list",
  description: "Get all the shipments",
  request: {
    query: z
      .object({
        marketplace: z.nativeEnum(Marketplace),
        storeId: z.string(),
        date: z.string().date(),
        carrierType: z.nativeEnum(CarrierType),
      })
      .partial(),
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.array(ListShipmentSchema),
          }),
        },
      },
    },
  },
})

export const getOne = createRoute({
  tags,
  method: "get",
  path: "/shipments/{id}",
  summary: "Get shipment by ID",
  description: "Get a shipment details",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: GetOneShipmentSchema,
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
  },
})

export const remove = createRoute({
  tags,
  method: "delete",
  path: "/shipments/{id}",
  summary: "Delete a shipment",
  description: "Delete a shipment of a company",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: {
      description: "successful",
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), data: z.object({ id: z.string() }) }),
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
      description: "invalid path params",
      content: {
        "application/json": {
          schema: createErrorSchema(IdParamsSchema),
        },
      },
    },
  },
})

export const buyShipment = createRoute({
  tags,
  method: "post",
  path: "/shipments/{shipmentId}/buy",
  summary: "Buy a shipment",
  description: "You can buy a shipment",
  request: {
    params: z.object({
      shipmentId: z.string().cuid2(),
    }),
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: JobInfoSchema,
          }),
        },
      },
    },
    400: {
      description: "Bad request",
      content: {
        "application/json": {
          schema: NotFoundSchema,
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
  },
})

export const generateSalesReport = createRoute({
  tags,
  method: "get",
  path: "/shipments/{shipmentId}/report",
  summary: "Generate Sales Report",
  description:
    "Generate a detailed sales report based on provided filters or sales data.",
  request: {
    params: z.object({
      shipmentId: z.string().cuid2(),
    }),
  },
  responses: {
    200: {
      description: "Successful operation",
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
  },
})

export type CreateShipment = typeof create
export type ListRoute = typeof list
export type GetOneRoute = typeof getOne
export type RemoveRoute = typeof remove
export type BuyShipmentRoute = typeof buyShipment
export type SalesReportRoute = typeof generateSalesReport
