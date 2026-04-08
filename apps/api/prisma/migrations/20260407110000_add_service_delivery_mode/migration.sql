CREATE TYPE "ServiceDeliveryMode" AS ENUM ('CBT_MANUAL', 'API_AUTOMATED', 'PIN_STOCK');

ALTER TABLE "Service"
ADD COLUMN "deliveryMode" "ServiceDeliveryMode" NOT NULL DEFAULT 'CBT_MANUAL';

ALTER TABLE "Order"
ADD COLUMN "deliveryMode" "ServiceDeliveryMode" NOT NULL DEFAULT 'CBT_MANUAL';

UPDATE "Service"
SET "deliveryMode" = CASE
  WHEN "fulfillmentType" = 'MANUAL' THEN 'CBT_MANUAL'::"ServiceDeliveryMode"
  ELSE 'API_AUTOMATED'::"ServiceDeliveryMode"
END;

UPDATE "Order"
SET "deliveryMode" = CASE
  WHEN "fulfillmentType" = 'MANUAL' THEN 'CBT_MANUAL'::"ServiceDeliveryMode"
  ELSE 'API_AUTOMATED'::"ServiceDeliveryMode"
END;

ALTER TABLE "Service"
ALTER COLUMN "deliveryMode" DROP DEFAULT;

ALTER TABLE "Order"
ALTER COLUMN "deliveryMode" DROP DEFAULT;

CREATE INDEX "Service_deliveryMode_idx" ON "Service"("deliveryMode");
CREATE INDEX "Order_deliveryMode_idx" ON "Order"("deliveryMode");
