/*
  Warnings:

  - You are about to drop the column `failReasons` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `returnShipmentIdentifier` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `shippingOrderMetadata` on the `Order` table. All the data in the column will be lost.
  - The `weightUnit` column on the `Order` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "DimensionUnit" AS ENUM ('MM', 'CM', 'M', 'INCH');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('G', 'KG', 'OZ', 'LB');

-- AlterTable
ALTER TABLE "Order" DROP COLUMN "failReasons",
DROP COLUMN "returnShipmentIdentifier",
DROP COLUMN "shippingOrderMetadata",
ADD COLUMN     "carrierlabelId" TEXT,
ADD COLUMN     "carrierreturnLabelId" TEXT,
ADD COLUMN     "dimensionUnit" "DimensionUnit" NOT NULL DEFAULT 'CM',
ADD COLUMN     "failureReasons" JSONB,
DROP COLUMN "weightUnit",
ADD COLUMN     "weightUnit" "WeightUnit" NOT NULL DEFAULT 'G';
