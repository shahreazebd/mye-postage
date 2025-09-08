-- CreateEnum
CREATE TYPE "CarrierType" AS ENUM ('EVRI', 'DHL', 'DPD', 'UPS', 'FEDEX', 'ROYAL_MAIL', 'AMAZON', 'TIKTOK');

-- CreateEnum
CREATE TYPE "Marketplace" AS ENUM ('AMAZON', 'EBAY', 'OTTO', 'SHOPIFY', 'WOOCOMMERCE', 'TIKTOK', 'TEMU', 'SHEIN', 'WALMART');

-- CreateEnum
CREATE TYPE "CredentialType" AS ENUM ('BEARER', 'BASIC', 'OAUTH');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('WAITING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PROCESSING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Carrier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CarrierType" NOT NULL,
    "companyId" TEXT NOT NULL,
    "shipperPhone" TEXT NOT NULL,
    "credentialType" "CredentialType" NOT NULL,
    "credentials" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "accountNumber" TEXT,
    "shipperName" TEXT,
    "shipperEmail" TEXT,
    "countryCode" TEXT,
    "city" TEXT,
    "postalCode" TEXT,
    "stateOrProvinceCode" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Carrier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shipment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "storeName" TEXT NOT NULL,
    "carrierType" "CarrierType" NOT NULL,
    "marketplace" "Marketplace" NOT NULL,
    "status" "ShipmentStatus" NOT NULL DEFAULT 'WAITING',
    "carrierId" TEXT NOT NULL,
    "metadata" JSONB,
    "batchLabelLink" TEXT,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "marketplaceOrderId" TEXT NOT NULL,
    "totalItems" INTEGER NOT NULL,
    "totalWeight" DOUBLE PRECISION NOT NULL,
    "weightUnit" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "originalSku" TEXT NOT NULL,
    "modifiedSku" TEXT NOT NULL,
    "address" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PROCESSING',
    "mergedOrderIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shipmentId" TEXT NOT NULL,
    "purchaseDate" TIMESTAMP(3),
    "labelLink" TEXT,
    "trackingNumber" TEXT,
    "returnShipmentIdentifier" TEXT,
    "shippingOrderMetadata" JSONB,
    "failReasons" JSONB,
    "trackingDescription" TEXT,
    "trackingDeliveredAt" TIMESTAMP(3),
    "trackingStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Shipment" ADD CONSTRAINT "Shipment_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "Shipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
