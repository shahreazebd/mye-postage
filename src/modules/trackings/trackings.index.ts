import { createRouter } from "@/lib/create-app"

import * as handlers from "./trackings.handlers"
import * as routes from "./trackings.routes"

export const trackings = createRouter().openapi(
  routes.trackingFedex,
  handlers.trackingFedex,
)
// .openapi(routes.patch, handlers.patch)
// .openapi(routes.remove, handlers.remove)
