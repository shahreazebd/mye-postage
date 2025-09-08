import { XiorError } from "xior"
import z from "zod"

import { carriersConfig } from "@/configs/carriers.config"
import { ApiError } from "@/lib/api-error"
import { CountryCode3LetterSchema, CurrencyCodeSchema } from "@/lib/schema-constants"
import { http } from "@/lib/xior"
import type { Shipment } from "@/modules/shipments/shipments.schemas"
import { uploadToS3 } from "@/modules/utils/utils.services"
import { updateOrderService } from "../orders/orders.services"
import { RoyalmailCredentialsSchema } from "./royalmail.schemas"
import { createRoyalmailBatchFlow } from "./royalmail.workers"

export type royalmailPayload = ReturnType<typeof convertToRoyalmailFormat>[number]

const royalmailShipmentSchema = z.object({
  carrier: z.object({
    shipperName: z.string().max(200).optional().default(""),
    shipperEmail: z.string().email().max(254).optional().default(""),
    shipperPhone: z.string().max(25),
  }),
  orders: z.array(
    z.object({
      id: z.string().max(50).optional(),
      marketplaceOrderId: z.string().max(40),
      address: z.object({
        buyerName: z.string().max(210),
        addressLine1: z.string().min(1).max(100),
        addressLine2: z.string().max(100).optional(),
        city: z.string().min(1).max(100),
        country: z.string().max(100),
        postCode: z.string().max(20),
        countryCode: CountryCode3LetterSchema,
        phone: z.string().nonempty().max(25),
        email: z.string().email().max(254),
      }),
      items: z.array(
        z.object({
          unitWeightInGrams: z.number().nonnegative().int(),
          name: z.string().max(800),
          localSku: z.string().max(100),
          quantity: z.number().int(),
          marketplaceSku: z.string().max(100),
        }),
      ),
      purchaseDate: z.coerce.date().default(new Date()),
      currency: CurrencyCodeSchema,
    }),
  ),
  metadata: z.object({
    serviceCode: z.enum([
      "BPL1",
      "BPL2",
      "BPR1",
      "BPR2",
      "CRL24",
      "CRL48",
      "OLA",
      "SD3",
      "SD6",
      "SDV",
      "SDW",
      "SDX",
      "SDY",
      "SDZ",
      "SEA",
      "SEB",
      "SEC",
      "SED",
      "STL1",
      "STL2",
      "TPN24",
      "TPS48",
    ]),
    packageFormatIdentifier: z.enum([
      "Letter",
      "LargeLetter",
      "SmallParcel",
      "MediumParcel",
      "Tube",
      "Parcel",
    ]),
    includeReturnsLabel: z.boolean().optional().default(false),
  }),
})

export function validateRoyalmailShipmentPayload(shipment: Shipment) {
  return royalmailShipmentSchema.parse(shipment)
}

function convertToRoyalmailFormat(shipment: Shipment) {
  const { carrier, orders, metadata } = validateRoyalmailShipmentPayload(shipment)

  const sender = {
    tradingName: carrier.shipperName,
    emailAddress: carrier.shipperEmail,
    phoneNumber: carrier.shipperPhone,
  }

  console.log(shipment.orders[0].items)

  const royalmailPayload = orders.map((order) => {
    const totalWeightInGrams = order.items.reduce(
      (sum, item) => sum + (item.unitWeightInGrams || 0),
      0,
    )

    const payload = {
      orderReference: order.marketplaceOrderId,
      isRecipientABusiness: false,
      recipient: {
        address: {
          fullName: order.address.buyerName,
          addressLine1: order.address.addressLine1, // order.address.addressLine1
          addressLine2: order.address.addressLine2,
          city: order.address.city,
          county: order.address.country,
          postcode: order.address.postCode,
          countryCode: order.address.countryCode,
        },
        phoneNumber: order.address.phone,
        emailAddress: order.address.email,
      },
      billing: {
        address: {
          fullName: order.address.buyerName,
          addressLine1: order.address.addressLine1,
          addressLine2: order.address.addressLine2,
          city: order.address.city,
          county: order.address.country,
          postcode: order.address.postCode,
          countryCode: order.address.countryCode,
        },
        phoneNumber: order.address.phone,
        emailAddress: order.address.email,
      },
      sender,
      packages: [
        {
          weightInGrams: totalWeightInGrams,
          packageFormatIdentifier: metadata.packageFormatIdentifier,
          // customPackageFormatIdentifier: metadata?.customPackageFormatIdentifier,
          //   dimensions: {
          //     heightInMms: 0,
          //     widthInMms: 0,
          //     depthInMms: 0,
          //   },
          contents: order.items.map((item) => {
            return {
              name: item.name,
              SKU: item.localSku,
              quantity: item.quantity,
              unitWeightInGrams: item.unitWeightInGrams,
              unitValue: 3,
              originCountryCode: "GBR",
              customsDeclarationCategory: "other",
            }
          }),
        },
      ],
      orderDate: order.purchaseDate,
      specialInstructions: "",
      subtotal: 0,
      shippingCostCharged: 0,
      total: 0,
      currencyCode: order.currency ?? "GBP",
      postageDetails: {
        sendNotificationsTo: "sender",
        serviceCode: metadata.serviceCode,
      },
      label: {
        includeLabelInResponse: true,
        includeReturnsLabel: false,
      },
      orderTax: 0,
    }

    return {
      royalmailPayload: payload,
      orderId: order.id,
      marketPlaceOrderId: order.marketplaceOrderId,
    }
  })

  return royalmailPayload
}

export async function createRoyalmailShipment(
  companyId: string,
  shipmentId: string,
  authKey: string,
  body: royalmailPayload,
) {
  try {
    const { data } = await http.post(
      `${carriersConfig.royalmail.apiUrl}/api/v1/orders`,
      { items: [body.royalmailPayload] },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: authKey,
        },
      },
    )

    if (data.successCount) {
      const createdOrder = data.createdOrders[0]

      if (!createdOrder.label) {
        throw new ApiError(400, "No label link found")
      }

      const trackingNumber = createdOrder.trackingNumber
      const b64 = `data:application/pdf;base64,${createdOrder.label}`

      const labelLink = await uploadToS3(
        companyId,
        shipmentId,
        body.orderId as string,
        b64,
      )

      await updateOrderService(body.orderId as string, {
        labelLink: labelLink,
        status: "SUCCESS",
        trackingNumber,
      })

      return { trackingNumber, labelLink }
    }

    if (data.errorsCount) {
      await updateOrderService(body.orderId as string, {
        status: "FAILED",
        failureReasons: data.failedOrders[0],
      })
      console.log({ error: "error thrown" })

      throw data.failedOrders[0]
    }
  } catch (error) {
    if (error instanceof XiorError) {
      await updateOrderService(body.orderId as string, {
        status: "FAILED",
        failureReasons: error.response?.data,
      })
      throw error.response?.data
    }

    if (error instanceof ApiError) {
      await updateOrderService(body.orderId as string, {
        status: "FAILED",
        failureReasons: {
          status: error.statusCode,
          message: error.message,
          meta: error.meta,
        },
      })
    }

    throw error
  }
}

export async function royalmailMQWorker(shipment: Shipment) {
  const payloads = convertToRoyalmailFormat(shipment)

  const credentials = RoyalmailCredentialsSchema.parse(shipment.carrier.credentials)

  const childJobs = payloads.map((payload) => ({
    payload: payload,
    token: credentials.authKey,
    companyId: shipment.companyId,
    shipmentId: shipment.id,
  }))

  const jobs = await createRoyalmailBatchFlow(shipment.id, childJobs)

  return jobs
}

export async function buyOneRoyalmailShippingWorker(shipment: Shipment) {
  const payloads = convertToRoyalmailFormat(shipment)

  const credentials = RoyalmailCredentialsSchema.parse(shipment.carrier.credentials)

  const res = await createRoyalmailShipment(
    shipment.companyId,
    shipment.id,
    credentials.authKey,
    payloads[0],
  )

  return res?.labelLink || ""
}
