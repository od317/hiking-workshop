-- CreateTable
CREATE TABLE "OrderStepAttachment" (
    "orderStepId" UUID NOT NULL,
    "attachmentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStepAttachment_pkey" PRIMARY KEY ("orderStepId","attachmentId")
);

-- AddForeignKey
ALTER TABLE "OrderStepAttachment" ADD CONSTRAINT "OrderStepAttachment_orderStepId_fkey" FOREIGN KEY ("orderStepId") REFERENCES "OrderStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStepAttachment" ADD CONSTRAINT "OrderStepAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
