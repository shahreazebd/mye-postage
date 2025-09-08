import type { ErrorHandler } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"
import { XiorError } from "xior"

import { ApiError } from "@/lib/api-error"

export const onError: ErrorHandler = (error, c) => {
  let statusCode: ContentfulStatusCode = 500
  const env = c.env?.NODE_ENV ?? process.env?.NODE_ENV
  let meta = error?.cause

  if (error instanceof ApiError) {
    statusCode = error.statusCode as ContentfulStatusCode
    meta = error.meta
  } else if (error instanceof XiorError) {
    statusCode = error.response?.status as ContentfulStatusCode
    meta = error.response?.data
  } else if ("status" in error && typeof error.status === "number") {
    statusCode = error.status as ContentfulStatusCode
  }

  // Handle ZodError: return issues as object, not string
  if (error.name === "ZodError" && "issues" in error && Array.isArray(error.issues)) {
    meta = error.issues
    statusCode = 422 as ContentfulStatusCode
  }

  const errorResponse = {
    success: false,
    message: error.name === "ZodError" ? "Validation Error" : error.message,
    error: {
      name: error.name,
      message: error.name === "ZodError" ? "Validation Error" : error.message,
      statusCode: statusCode,
      meta: meta,
      ...(env === "development" && { stack: error.stack }),
    },
  }

  return c.json(errorResponse, statusCode as ContentfulStatusCode)
}
