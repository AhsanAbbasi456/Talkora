-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "ConversationMember" ADD COLUMN     "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
