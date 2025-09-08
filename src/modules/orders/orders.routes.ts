import { ForbiddenSchema, IdParamsSchema, NotFoundSchema } from "@/lib/schema-constants"
import { createRoute, z } from "@hono/zod-openapi"
import { createErrorSchema } from "stoker/openapi/schemas"
import {
  CreateOrderSchema,
  OrderListSchema,
  OrderSchema,
  UpdateOrderSchema,
} from "./orders.schemas"

const tags = ["Orders"]

export const create = createRoute({
  tags,
  method: "post",
  path: "/orders",
  summary: "Create a new order",
  description:
    "Submit a new order to the postage system. This endpoint accepts order details in JSON format and returns the created order information upon success.",
  request: {
    body: {
      description: "Order details to be created",
      content: {
        "application/json": {
          schema: CreateOrderSchema.extend({ shipmentId: z.string().cuid2() }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Order successfully created",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: OrderSchema,
          }),
        },
      },
    },
    422: {
      description: "Invalid request body",
      content: {
        "application/json": {
          schema: createErrorSchema(CreateOrderSchema),
        },
      },
    },
  },
})

export const list = createRoute({
  tags,
  method: "get",
  path: "/orders",
  summary: "List all orders",
  description:
    "Retrieves a list of all orders in the postage system. You can optionally filter results using query parameters.",
  request: {
    query: z.object({
      shipmentId: z.string().cuid2(),
    }),
  },
  responses: {
    200: {
      description: "Orders retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: OrderListSchema,
          }),
        },
      },
    },
  },
})

export const getOne = createRoute({
  tags,
  method: "get",
  path: "/orders/{id}",
  summary: "Get order by ID",
  description: "Retrieves the details of a specific order using its unique identifier.",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: {
      description: "Order retrieved successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: OrderSchema,
          }),
        },
      },
    },
    404: {
      description: "Order not found",
      content: {
        "application/json": {
          schema: NotFoundSchema,
        },
      },
    },
    422: {
      description: "Invalid path parameters",
      content: {
        "application/json": {
          schema: createErrorSchema(IdParamsSchema),
        },
      },
    },
  },
})

export const update = createRoute({
  tags,
  method: "patch",
  path: "/orders/{id}",
  summary: "Update an order",
  description:
    "Updates the details of an existing order in the postage system. You must provide the order ID in the path and the updated order data in the request body.",
  request: {
    params: IdParamsSchema,
    body: {
      description: "Updated order details",
      content: {
        "application/json": {
          schema: UpdateOrderSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Order successfully updated",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: OrderSchema,
          }),
        },
      },
    },
    404: {
      description: "Order not found",
      content: {
        "application/json": {
          schema: NotFoundSchema,
        },
      },
    },
    403: {
      description: "Not authorized",
      content: {
        "application/json": {
          schema: ForbiddenSchema,
        },
      },
    },
    422: {
      description: "Invalid request body or path parameters",
      content: {
        "application/json": {
          schema: createErrorSchema(UpdateOrderSchema),
        },
      },
    },
  },
})

export const remove = createRoute({
  tags,
  method: "delete",
  path: "/orders/{id}",
  summary: "Delete an order",
  description:
    "Removes a specific order by its unique identifier. If the order exists, it will be deleted and the deleted order's ID will be returned. If the order does not exist, a 404 error will be returned.",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: {
      description: "Order successfully deleted",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.object({ id: z.string() }),
          }),
        },
      },
    },
    404: {
      description: "Order not found",
      content: {
        "application/json": {
          schema: NotFoundSchema,
        },
      },
    },
    403: {
      description: "Not authorized",
      content: {
        "application/json": {
          schema: ForbiddenSchema,
        },
      },
    },
    422: {
      description: "Invalid path parameters",
      content: {
        "application/json": {
          schema: createErrorSchema(IdParamsSchema),
        },
      },
    },
  },
})

export const buyOneShipping = createRoute({
  tags,
  method: "post",
  path: "/orders/{id}/buy",
  summary: "Buy a label for an order",
  description: "Initiates the purchase of a shipping label for a specific order.",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: {
      description: "Shipping label successfully purchased.",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            data: z.string(),
          }),
        },
      },
    },
    404: {
      description: "Order not found.",
      content: {
        "application/json": {
          schema: NotFoundSchema,
        },
      },
    },
    422: {
      description: "Invalid shipment details provided.",
      content: {
        "application/json": {
          schema: createErrorSchema(IdParamsSchema),
        },
      },
    },
  },
})

export type CreateRoute = typeof create
export type ListRoute = typeof list
export type GetOneRoute = typeof getOne
export type UpdateRoute = typeof update
export type RemoveRoute = typeof remove

export type BuyOneShippingRoute = typeof buyOneShipping
