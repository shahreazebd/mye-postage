import { IdParamsSchema, NotFoundSchema } from "@/lib/schema-constants"
import { createRoute, z } from "@hono/zod-openapi"
import { CarrierType } from "generated/prisma"
import { createErrorSchema } from "stoker/openapi/schemas"
import {
  CarrierSchema,
  CreateCarrierSchema,
  UpdateCarrierSchema,
} from "./carriers.schemas"

const tags = ["Carriers"]

export const create = createRoute({
  tags,
  method: "post",
  path: "/carriers",
  summary: "Create a carrier",
  description: "You can create carriers for your postage system.",
  request: {
    body: {
      description: "The carrier to create",
      content: {
        "application/json": {
          schema: CreateCarrierSchema,
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
            redirectURI: z.string().optional(),
            data: CarrierSchema,
          }),
        },
      },
    },
    422: {
      description: "invalid body",
      content: {
        "application/json": {
          schema: createErrorSchema(CreateCarrierSchema),
        },
      },
    },
  },
})

export const list = createRoute({
  tags,
  method: "get",
  path: "/carriers",
  summary: "Get carrier list",
  description: "Retrieve a list of all carriers in the postage system.",
  request: {
    query: z.object({
      type: z.nativeEnum(CarrierType).optional(),
    }),
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: z.array(CarrierSchema),
          }),
        },
      },
    },
  },
})

export const getOne = createRoute({
  tags,
  method: "get",
  path: "/carriers/{id}",
  summary: "Get carrier by ID",
  description: "Get a carrier",
  request: {
    params: IdParamsSchema,
  },
  responses: {
    200: {
      description: "successful operation",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            data: CarrierSchema,
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
      description: "Invalid path params",
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
  method: "put",
  path: "/carriers/{id}",
  summary: "Update a carrier",
  description: "You can update carriers for your postage system.",
  request: {
    params: IdParamsSchema,
    body: {
      description: "The carrier to update",
      content: {
        "application/json": {
          schema: UpdateCarrierSchema,
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
            data: CarrierSchema,
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
          schema: createErrorSchema(UpdateCarrierSchema),
        },
      },
    },
  },
})

export const toggleDefault = createRoute({
  tags,
  method: "patch",
  path: "/carriers/{id}",
  summary: "Toggle default carrier",
  description: "You can toggle the default status of a carrier.",
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
            data: CarrierSchema,
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
  },
})

export const remove = createRoute({
  tags,
  method: "delete",
  path: "/carriers/{id}",
  summary: "Delete a carrier",
  description: "Delete a carrier of a company",
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

export type ListRoute = typeof list
export type GetOneRoute = typeof getOne
export type CreateRoute = typeof create
export type UpdateRoute = typeof update
export type ToggleDefaultRoute = typeof toggleDefault
export type RemoveRoute = typeof remove
