-- CreateEnum
CREATE TYPE "WorkshopLedgerEntryType" AS ENUM ('CHARGE', 'PAYMENT', 'ADJUST');

-- CreateTable
CREATE TABLE "Workshop" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Workshop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopBatch" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderLineId" UUID NOT NULL,
    "workshopId" UUID NOT NULL,
    "sentQty" INTEGER NOT NULL,
    "ratePerPieceMinor" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "WorkshopBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopBatchReceipt" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopBatchReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkshopLedgerEntry" (
    "id" UUID NOT NULL,
    "workshopId" UUID NOT NULL,
    "type" "WorkshopLedgerEntryType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "batchId" UUID,
    "note" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkshopLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkshopBatch_orderId_idx" ON "WorkshopBatch"("orderId");

-- CreateIndex
CREATE INDEX "WorkshopBatch_orderLineId_idx" ON "WorkshopBatch"("orderLineId");

-- CreateIndex
CREATE INDEX "WorkshopBatch_workshopId_idx" ON "WorkshopBatch"("workshopId");

-- CreateIndex
CREATE INDEX "WorkshopBatchReceipt_batchId_idx" ON "WorkshopBatchReceipt"("batchId");

-- CreateIndex
CREATE INDEX "WorkshopLedgerEntry_workshopId_idx" ON "WorkshopLedgerEntry"("workshopId");

-- CreateIndex
CREATE INDEX "WorkshopLedgerEntry_batchId_idx" ON "WorkshopLedgerEntry"("batchId");

-- AddForeignKey
ALTER TABLE "Workshop" ADD CONSTRAINT "Workshop_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBatch" ADD CONSTRAINT "WorkshopBatch_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBatch" ADD CONSTRAINT "WorkshopBatch_orderLineId_fkey" FOREIGN KEY ("orderLineId") REFERENCES "OrderLine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBatch" ADD CONSTRAINT "WorkshopBatch_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBatch" ADD CONSTRAINT "WorkshopBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBatchReceipt" ADD CONSTRAINT "WorkshopBatchReceipt_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WorkshopBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopBatchReceipt" ADD CONSTRAINT "WorkshopBatchReceipt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopLedgerEntry" ADD CONSTRAINT "WorkshopLedgerEntry_workshopId_fkey" FOREIGN KEY ("workshopId") REFERENCES "Workshop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopLedgerEntry" ADD CONSTRAINT "WorkshopLedgerEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "WorkshopBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkshopLedgerEntry" ADD CONSTRAINT "WorkshopLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
