import { createRouter } from "@/lib/create-app"

import * as handlers from "./utils.handlers"
import * as routes from "./utils.routes"

export const utils = createRouter()
  .openapi(routes.uploadFile, handlers.uploadFile)
  .openapi(routes.convertFile, handlers.convertFile)
  .openapi(routes.convertPdf, handlers.convertPdf)
  .openapi(routes.findZPL, handlers.findZPL)
  .openapi(routes.mergePDF, handlers.mergePDF)
  .openapi(routes.validateAddress, handlers.validateAddress)
