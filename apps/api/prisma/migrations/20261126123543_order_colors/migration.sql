-- CreateTable
CREATE TABLE "OrderColor" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderColor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderColorAttachment" (
    "orderColorId" UUID NOT NULL,
    "attachmentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderColorAttachment_pkey" PRIMARY KEY ("orderColorId","attachmentId")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderColor_orderId_name_key" ON "OrderColor"("orderId", "name");

-- AddForeignKey
ALTER TABLE "OrderColor" ADD CONSTRAINT "OrderColor_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderColorAttachment" ADD CONSTRAINT "OrderColorAttachment_orderColorId_fkey" FOREIGN KEY ("orderColorId") REFERENCES "OrderColor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderColorAttachment" ADD CONSTRAINT "OrderColorAttachment_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "OrderColor" ("id","orderId","name")
SELECT gen_random_uuid(), "orderId", "color" FROM "OrderLine" GROUP BY "orderId","color";