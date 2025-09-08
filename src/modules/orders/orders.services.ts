import { broadcast } from "@/index"
import { prisma } from "prisma"
import type { UpdateOrder } from "./orders.schemas"

export async function updateOrderService(id: string, order: UpdateOrder) {
  const res = await prisma.order.update({
    where: { id: id },
    data: order,
    select: { id: true, marketplaceOrderId: true },
  })

  broadcast({ event: "update-order", data: res })

  return res
}
