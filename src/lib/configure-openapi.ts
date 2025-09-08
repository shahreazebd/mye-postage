import type { AppOpenAPI } from "./types"

import { apiReference } from "@scalar/hono-api-reference"

export function configureOpenAPI(app: AppOpenAPI) {
  app.doc("/doc", {
    openapi: "3.0.0",
    info: {
      version: "1.0.0",
      title: "MYE Postage Service",
      description: "MYE Postage Service API",
    },
  })

  app.openAPIRegistry.registerComponent("securitySchemes", "Bearer", {
    type: "http",
    scheme: "bearer",
    description: "Use the Bearer token for authentication",
  })

  app.get(
    "/reference",
    apiReference({
      spec: {
        url: "/doc",
      },
    }),
  )
}
