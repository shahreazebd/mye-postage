import { NotFoundSchema } from "@/lib/schema-constants"
import { createRoute, z } from "@hono/zod-openapi"
import { FedexTrackingSchema } from "./trackings.schemas"

const tags = ["Trackings"]

export const trackingFedex = createRoute({
  tags,
  method: "post",
  path: "/trackings/fedex",
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
            success: z.boolean().openapi({ example: true }),
            message: z.string().openapi({ example: "Service created successfully" }),
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

export type TrackingFedexRoute = typeof trackingFedex
