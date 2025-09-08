import { createRouter } from "@/lib/create-app"
import * as handlers from "./royalmail.handlers"
import * as routes from "./royalmail.routes"

export const royalmail = createRouter()
  .openapi(routes.royalmailShipments, handlers.royalmailShipments)
  .openapi(routes.getRoyalmailValidPackaging, handlers.getRoyalmailValidPackaging)
