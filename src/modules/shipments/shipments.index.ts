import { createRouter } from "@/lib/create-app"

import * as handlers from "./shipments.handlers"
import * as routes from "./shipments.routes"

export const shipments = createRouter()
  .openapi(routes.create, handlers.create)
  .openapi(routes.list, handlers.list)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.remove, handlers.remove)
  .openapi(routes.buyShipment, handlers.buyShipment)
  .openapi(routes.generateSalesReport, handlers.generateSalesReport)
