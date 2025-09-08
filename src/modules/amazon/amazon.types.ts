// amazon auth response

export type GetTokenResponse = {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

// amazon rates response

export type AmazonRatesResponse = {
  payload: Payload
}

type Payload = {
  requestToken: string
  rates: Rate[]
  ineligibleRates: unknown[]
}

type Rate = {
  rateId: string
  carrierId: string
  carrierName: string
  serviceId: string
  serviceName: string
  promise: Promise
  supportedDocumentSpecifications: SupportedDocumentSpecification[]
  availableValueAddedServiceGroups: unknown[]
  totalCharge: BilledWeight
  billedWeight: BilledWeight
  requiresAdditionalInputs: boolean
  rateItemList: null
  paymentType: null
  benefits: null
}

type BilledWeight = {
  value: number
  unit: string
}

type Promise = {
  pickupWindow: Window
  deliveryWindow: Window
}

type Window = {
  start: Date
  end: Date
}

type SupportedDocumentSpecification = {
  format: string
  size: Size
  printOptions: PrintOption[]
}

type PrintOption = {
  supportedDPIs: number[]
  supportedPageLayouts: string[]
  supportedFileJoiningOptions: boolean[]
  supportedDocumentDetails: SupportedDocumentDetail[]
}

type SupportedDocumentDetail = {
  name: string
  isMandatory: boolean
}

type Size = {
  width: number
  length: number
  unit: string
}

// buy amazon shipment

export type BuyAmazonLabelResponse = {
  payload: {
    shipmentId: string
    packageDocumentDetails: PackageDocumentDetail[]
    promise: Promise
    benefits: Benefits
  }
}

type Benefits = {
  includedBenefits: string[]
  excludedBenefits: unknown[]
}

type PackageDocumentDetail = {
  packageClientReferenceId: string
  packageDocuments: PackageDocument[]
  trackingId: number
}

type PackageDocument = {
  type: string
  format: string
  contents: string
}
