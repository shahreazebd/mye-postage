import { createRouter } from "@/lib/create-app"

import * as handlers from "./orders.handlers"
import * as routes from "./orders.routes"

export const orders = createRouter()
  .openapi(routes.list, handlers.list)
  .openapi(routes.create, handlers.create)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.update, handlers.update)
  .openapi(routes.remove, handlers.remove)
  .openapi(routes.buyOneShipping, handlers.buyOneShipping)
