-- CreateIndex
CREATE INDEX "Carrier_companyId_type_idx" ON "public"."Carrier"("companyId", "type");

-- CreateIndex
CREATE INDEX "Order_shipmentId_idx" ON "public"."Order"("shipmentId");

-- CreateIndex
CREATE INDEX "Shipment_companyId_carrierType_marketplace_idx" ON "public"."Shipment"("companyId", "carrierType", "marketplace");
