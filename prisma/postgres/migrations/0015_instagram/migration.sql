-- AlterTable
ALTER TABLE "Lead" ALTER COLUMN "telefone" DROP NOT NULL,
ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'whatsapp',
ADD COLUMN "igsid" TEXT,
ADD COLUMN "igUsuario" TEXT;

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'whatsapp';

-- CreateIndex
CREATE UNIQUE INDEX "Lead_igsid_key" ON "Lead"("igsid");
