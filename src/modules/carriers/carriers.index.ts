import { createRouter } from "@/lib/create-app"

import * as handlers from "./carriers.handlers"
import * as routes from "./carriers.routes"

export const carriers = createRouter()
  .openapi(routes.create, handlers.create)
  .openapi(routes.list, handlers.list)
  .openapi(routes.getOne, handlers.getOne)
  .openapi(routes.update, handlers.update)
  .openapi(routes.toggleDefault, handlers.toggleDefault)
  .openapi(routes.remove, handlers.remove)
