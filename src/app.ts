import { configureBullBoard } from "./lib/configure-bullboard"
import { configureOpenAPI } from "./lib/configure-openapi"
import { createApp } from "./lib/create-app"
import { amazon } from "./modules/amazon/amazon.index"
import { carriers } from "./modules/carriers/carriers.index"
import { dhl } from "./modules/dhl/dhl.index"
import { evri } from "./modules/evri/evri.index"
import { fedex } from "./modules/fedex/fedex.index"
import { index } from "./modules/index.routes"
import { orders } from "./modules/orders/orders.index"
import { royalmail } from "./modules/royalmail/royalmail.index"
import { shipments } from "./modules/shipments/shipments.index"
import { trackings } from "./modules/trackings/trackings.index"
import { utils } from "./modules/utils/utils.index"

import "@/modules/dhl/dhl.workers"
import "@/modules/fedex/fedex.workers"
import "@/modules/royalmail/royalmail.workers"
import "@/modules/amazon/amazon.workers"
import { configureEvriCallback } from "./lib/configure-evri-callback"

const routes = [
  index,
  carriers,
  shipments,
  orders,
  amazon,
  dhl,
  evri,
  fedex,
  royalmail,
  trackings,
  utils,
]

export const app = createApp()

configureOpenAPI(app)
configureBullBoard(app)
configureEvriCallback(app)

for (const route of routes) {
  app.route("/", route)
}
