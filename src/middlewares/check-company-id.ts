import { ApiError } from "@/lib/api-error"
import { createMiddleware } from "hono/factory"

export function checkCompanyId() {
  return createMiddleware(async (c, next) => {
    const headers = c.req.header()

    if (!headers["x-company-id"] && !headers["x-user-id"]) {
      throw new ApiError(401, "No x-company-id and x-user-id found in headers")
    }

    c.set("jwtPayload", {
      companyId: headers["x-company-id"],
      userId: headers["x-user-id"],
    })

    await next()
  })
}
