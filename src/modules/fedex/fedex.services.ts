import pLimit from "p-limit"
import { XiorError } from "xior"

import { carriersConfig } from "@/configs/carriers.config"
import { ApiError } from "@/lib/api-error"
import { chunk } from "@/lib/utils"
import { http } from "@/lib/xior"
import type { Shipment } from "@/modules/shipments/shipments.schemas"
import { uploadToS3 } from "@/modules/utils/utils.services"
import { updateOrderService } from "../orders/orders.services"
import type { ValidateAddress } from "../utils/utils.schema"
import { createFedexBatchFlow } from "./fedex.workers"

export type FedexPayload = ReturnType<typeof convertToFedExFormat>[number]

export function convertToFedExFormat(payload: Shipment) {
  const shipperAddress = {
    contact: {
      personName: payload.carrier.shipperName, // max=70
      phoneNumber: payload.carrier.shipperPhone, // required min=10 max=15
      companyName: "Evident",
      // deptName: "SndrDeaptNm",
      // emailAddress: payload.carrier.shipperEmail, // max=80
    },
    address: {
      streetLines: [payload.carrier.addressLine1, payload.carrier.addressLine2], // required max 35 chars
      city: payload.carrier.city, // required max 35 chars
      stateOrProvinceCode: payload.carrier.stateOrProvinceCode,
      postalCode: payload.carrier.postalCode, // max 10 chars
      countryCode: payload.carrier.countryCode, // max 2 chars
    },
  }

  const fedexShippingPayload = payload.orders.map((order) => {
    const recipients = {
      contact: {
        personName: order.address.buyerName,
        phoneNumber: order.address.phone,
      },
      address: {
        streetLines: [order.address.addressLine1, order.address.addressLine2].filter(
          Boolean,
        ),
        city: order.address.city,
        postalCode: order.address.postCode,
        countryCode: order.address.countryCode,
      },
    }

    const totalWeight = order.items.reduce(
      (sum, order) => sum + (order.unitWeightInGrams || 0),
      0,
    )

    const fedexPayload = {
      labelResponseOptions: "LABEL",
      mergeLabelDocOption: "LABELS_ONLY",
      requestedShipment: {
        shipper: shipperAddress,
        recipients: [recipients],
        shipDatestamp: new Date().toISOString().split("T")[0],
        serviceType: payload.metadata.serviceType, // required
        // "CONTACT_FEDEX_TO_SCHEDULE" "DROPOFF_AT_FEDEX_LOCATION" "USE_SCHEDULED_PICKUP"
        packagingType: payload.metadata.packagingType, // required
        pickupType: payload.metadata.pickupType, // required
        totalWeight: totalWeight,
        blockInsightVisibility: false,
        shippingChargesPayment: {
          paymentType: "SENDER",
        },
        labelSpecification: {
          imageType: "PDF",
          labelStockType: "STOCK_4X675",
        },
        requestedPackageLineItems: [
          {
            weight: {
              value: totalWeight / 1000, //required
              units: order.weightUnit || "KG", // required KG or LB
            },
          },
        ],
      },
      accountNumber: {
        value: payload?.carrier?.accountNumber, // required 9 chars
      },
    }

    return {
      orderId: order.id,
      fedexPayload,
      marketPlaceOrderId: order.marketplaceOrderId,
    }
  })

  return fedexShippingPayload
}

export async function verifyFedexCredentials(client_id: string, client_secret: string) {
  const params = new URLSearchParams({
    grant_type: "client_credentials",
    client_id,
    client_secret,
  })

  const url = `${carriersConfig.fedex.apiUrl}/oauth/token`

  try {
    const res = await http.post(url, params.toString(), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })

    return res.data?.access_token
  } catch (err: unknown) {
    if (err instanceof XiorError) {
      throw new ApiError(
        err.response?.status || 500,
        err?.response?.statusText || "Unknown error",
        err?.response?.data,
      )
    }
    throw new ApiError(500, "Fedex authentication failed", { error: err })
  }
}

async function validateFedexShipmentPayload(
  token: string,
  body: ReturnType<typeof convertToFedExFormat>[number],
) {
  const url = `${carriersConfig.fedex.apiUrl}/ship/v1/shipments/packages/validate`

  try {
    const res = await http.post(url, body.fedexPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    return {
      data: res.data,
      marketPlaceOrderId: body.marketPlaceOrderId,
    }
  } catch (error) {
    if (error instanceof XiorError) {
      throw {
        error: error.response?.data,
        marketPlaceOrderId: body.marketPlaceOrderId,
      }
    }
  }
}

export async function createFedexShipmentSandbox(
  companyId: string,
  shipmentId: string,
  token: string,
  body: ReturnType<typeof convertToFedExFormat>[number],
) {
  const url = `${carriersConfig.fedex.apiUrl}/ship/v1/shipments`

  try {
    const res = await http.post(url, body.fedexPayload, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const trackingNumber =
      res.data.output.transactionShipments[0].pieceResponses[0].trackingNumber

    const labelLink = await uploadToS3(
      companyId,
      shipmentId,
      body.orderId,
      `data:application/pdf;base64,${res.data.output.transactionShipments[0].pieceResponses[0].packageDocuments[0].encodedLabel}`,
    )

    await updateOrderService(body.orderId, {
      labelLink: labelLink,
      status: "SUCCESS",
      trackingNumber,
    })

    return { trackingNumber, labelLink }
  } catch (error) {
    if (error instanceof XiorError) {
      await updateOrderService(body.orderId, {
        status: "FAILED",
        failureReasons: error.response?.data,
      })
      throw error.response?.data
    }
  }
}

export async function validateFedexShipmentWorker(shipment: Shipment) {
  const payloads = convertToFedExFormat(shipment)
  const { clientId, clientSecret } = shipment.carrier.credentials

  const token = await verifyFedexCredentials(clientId, clientSecret)

  const FEDEX_CONCURRENCY = 10
  const limit = pLimit(FEDEX_CONCURRENCY)

  const tasks: Promise<unknown>[] = []

  for (const p of payloads) {
    tasks.push(limit(() => validateFedexShipmentPayload(token, p)))
  }

  const results = await Promise.allSettled(tasks)

  const successCount = results.filter((r) => r.status === "fulfilled").length
  const failCount = results.length - successCount

  return { successCount, failCount, results }
}

export async function fedexMQWorker(shipment: Shipment) {
  const payloads = convertToFedExFormat(shipment)
  const { clientId, clientSecret } = shipment.carrier.credentials

  const token = await verifyFedexCredentials(clientId, clientSecret)

  const childJobs = payloads.map((payload) => ({
    payload: payload,
    token: token,
    companyId: shipment.companyId,
    shipmentId: shipment.id,
  }))

  const res = await createFedexBatchFlow(shipment.id, childJobs)

  return res
}

export async function buyOneFedexShippingWorker(shipment: Shipment) {
  const payloads = convertToFedExFormat(shipment)
  const { clientId, clientSecret } = shipment.carrier.credentials

  const token = await verifyFedexCredentials(clientId, clientSecret)

  const res = await createFedexShipmentSandbox(
    shipment.companyId,
    shipment.id,
    token,
    payloads[0],
  )

  return res?.labelLink || ""
}

export function convertToFedExRatesAndTransitTimeFormat(payload: Shipment) {
  const recipientOrder = payload.orders[0]

  const data = {
    accountNumber: {
      value: payload.carrier.accountNumber,
    },
    requestedShipment: {
      preferredCurrency: "GBP",
      rateRequestType: ["PREFERRED"],
      packagingType: payload.metadata.packagingType,
      serviceType: payload.metadata.serviceType,
      pickupType: payload.metadata.pickupType,
      shipper: {
        address: {
          streetLines: [payload.carrier.addressLine1, payload.carrier.addressLine2],
          city: payload.carrier.city,
          stateOrProvinceCode: payload.carrier.stateOrProvinceCode,
          postalCode: payload.carrier.postalCode,
          countryCode: payload.carrier.countryCode,
        },
      },
      recipient: {
        address: {
          streetLines: [
            recipientOrder.address.addressLine1,
            recipientOrder.address.addressLine2,
          ].filter(Boolean),
          city: recipientOrder.address.city,
          postalCode: recipientOrder.address.postCode,
          countryCode: recipientOrder.address.countryCode,
        },
      },
      requestedPackageLineItems: recipientOrder.items.map((item) => ({
        weight: {
          units: "KG",
          value: item.unitWeightInGrams / 1000, // convert grams to kg
        },
      })),
    },
  }

  return data
}

export async function validateAddressByFedex(addresses: ValidateAddress, token: string) {
  const CHUNK_SIZE = 2

  try {
    const chunks = chunk(addresses, CHUNK_SIZE)

    const promises = chunks.map((c) => {
      const data = {
        addressesToValidate: c.map(() => {
          return {
            address: {
              streetLines: ["Udsholt Byvej 27"],
              city: "",
              stateOrProvinceCode: "",
              postalCode: "3230",
              countryCode: "DK",
            },
          }
        }),
      }

      return http.request<{
        output: { resolvedAddresses: object[] }
        transectionId: string
      }>({
        method: "POST",
        url: `${carriersConfig.fedex.apiUrl}/address/v1/addresses/resolve`,
        headers: {
          Authorization: `Bearer ${token}`,
        },
        data,
      })
    })

    const res = await Promise.allSettled(promises)

    const succeed = res
      .filter((e) => e.status === "fulfilled")
      .flatMap((e) => e.value.data.output.resolvedAddresses)

    return succeed
  } catch (error) {
    console.log(error)
  }
}
