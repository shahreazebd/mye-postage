import { prisma } from "prisma"
import xior from "xior"

import { carriersConfig } from "@/configs/carriers.config"
import { ApiError } from "@/lib/api-error"
import type { AppRouteHandler } from "@/lib/types"
import { verifyFedexCredentials } from "@/modules/fedex/fedex.services"
import type { TrackingFedexRoute } from "./trackings.routes"

export const trackingFedex: AppRouteHandler<TrackingFedexRoute> = async (c) => {
  const { carrierId, trackingNumber } = c.req.valid("json")

  const carrier = await prisma.carrier.findUnique({ where: { id: carrierId } })

  if (!carrier) {
    throw new ApiError(404, "Service not found")
  }

  const creds = carrier.credentials as { clientId: string; clientSecret: string }

  const token = await verifyFedexCredentials(creds.clientId, creds.clientSecret)

  const response = await xior.post(
    `${carriersConfig.fedex.apiUrl}/track/v1/trackingnumbers`,
    {
      trackingInfo: [
        {
          trackingNumberInfo: {
            trackingNumber,
          },
        },
      ],
      includeDetailedScans: true,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  )

  return c.json({
    success: true,
    message: "FedEx tracking created successfully",
    data: response.data,
  })
}
