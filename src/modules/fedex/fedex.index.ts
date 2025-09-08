import { createRouter } from "@/lib/create-app"

import * as handlers from "./fedex.handlers"
import * as routes from "./fedex.routes"

export const fedex = createRouter()
  .openapi(routes.getFedexToken, handlers.getFedexToken)
  .openapi(routes.createFedexShipments, handlers.createFedexShipments)
  .openapi(routes.createFedexTrackings, handlers.createFedexTrackings)
  .openapi(routes.createFedexRatesAndTransitTime, handlers.createFedexRatesAndTransitTime)
