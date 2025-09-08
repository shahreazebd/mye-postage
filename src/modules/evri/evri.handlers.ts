import { ApiError } from "@/lib/api-error"
import type { AppRouteHandler } from "@/lib/types"
import type { GetEvriTokenRoute } from "./evri.routes"
import { getTokenFromEvri } from "./evri.services"

export const getEvriToken: AppRouteHandler<GetEvriTokenRoute> = async (c) => {
  const { clientId, clientSecret, code } = c.req.valid("json")

  const creds = await getTokenFromEvri({ clientId, clientSecret, code })

  if (!creds) {
    throw new ApiError(401, "Invalid credentials")
  }

  return c.json({ success: true, data: creds }, 200)
}
