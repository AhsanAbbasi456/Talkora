-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "mediaExpired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "viewOnce" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MessageView" (
    "id" SERIAL NOT NULL,
    "messageId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageView_messageId_idx" ON "MessageView"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageView_messageId_userId_key" ON "MessageView"("messageId", "userId");

-- AddForeignKey
ALTER TABLE "MessageView" ADD CONSTRAINT "MessageView_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageView" ADD CONSTRAINT "MessageView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
