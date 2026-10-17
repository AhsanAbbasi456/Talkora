-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "createdBy" INTEGER,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'DIRECT';

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "role" TEXT NOT NULL DEFAULT 'MEMBER';

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
