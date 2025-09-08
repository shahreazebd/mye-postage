import { createRouter } from "@/lib/create-app"
import * as handlers from "./amazon.handlers"
import * as routes from "./amazon.routes"

export const amazon = createRouter()
  .openapi(routes.getAmazonToken, handlers.getAmazonToken)
  .openapi(routes.fetchAmazonRates, handlers.fetchAmazonRates)
  .openapi(routes.fetchAmazonRatesBulk, handlers.fetchAmazonRatesBulk)
  .openapi(routes.createAmazonShipments, handlers.createAmazonShipments)
