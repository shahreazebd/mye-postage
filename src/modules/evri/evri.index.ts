import { createRouter } from "@/lib/create-app"
import * as handlers from "./evri.handlers"
import * as routes from "./evri.routes"

export const evri = createRouter().openapi(routes.getEvriToken, handlers.getEvriToken)
