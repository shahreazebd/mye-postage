import { createRouter } from "@/lib/create-app"

import * as handlers from "./dhl.handlers"
import * as routes from "./dhl.routes"

export const dhl = createRouter()
  .openapi(routes.createDhlShipments, handlers.createDhlShipments)
  .openapi(routes.getDHLToken, handlers.getDHLToken)
