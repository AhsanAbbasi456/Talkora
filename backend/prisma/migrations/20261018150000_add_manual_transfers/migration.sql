-- AlterTable
ALTER TABLE "PaymentOrder" ADD COLUMN     "manualMethod" TEXT,
ADD COLUMN     "manualSender" TEXT,
ADD COLUMN     "manualTid" TEXT,
ADD COLUMN     "proofFile" TEXT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_manualTid_key" ON "PaymentOrder"("manualTid");

