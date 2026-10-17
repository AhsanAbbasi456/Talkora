-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "fileSize" INTEGER,
ADD COLUMN     "fileUrl" TEXT,
ADD COLUMN     "messageType" TEXT NOT NULL DEFAULT 'TEXT',
ADD COLUMN     "mimeType" TEXT,
ALTER COLUMN "body" DROP NOT NULL;
