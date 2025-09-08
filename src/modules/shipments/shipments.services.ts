import { removeSpecialChar } from "@/lib/utils"
import type { Marketplace, OrderStatus } from "generated/prisma"
import type { Order } from "../orders/orders.schemas"
import type { Shipment } from "./shipments.schemas"

export function generateSalesReport(shipment: Shipment) {
  const successOrderList = mapOrderItemsByStatus(
    shipment.orders,
    "SUCCESS",
    shipment.marketplace,
  )

  const failedOrderList = mapOrderItemsByStatus(
    shipment.orders,
    "FAILED",
    shipment.marketplace,
  )

  const empty = {
    ...(shipment.marketplace === "AMAZON" && {
      "Order ID": "",
    }),
    SKU: "",
    Quantity: null,
    Buyer: "",
  }

  const hasFailedOrders = failedOrderList.length > 0

  const data = removeSpecialChar([
    ...successOrderList,
    ...(hasFailedOrders ? [empty, ...successOrderList] : []),
  ])

  return data
}

function mapOrderItemsByStatus(
  orders: Order[],
  status: OrderStatus,
  marketplace: Marketplace,
) {
  return orders
    .filter((order) => order.status === status)
    .flatMap(
      (order) =>
        order.items?.map((item) => ({
          ...(marketplace === "AMAZON" && {
            "Order ID": order.marketplaceOrderId,
          }),
          SKU: item.localSku,
          Quantity: item.quantity,
          Buyer: order.address.buyerName,
        })) ?? [],
    )
}
