-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "consentimentoEm" TIMESTAMP(3),
ADD COLUMN     "consentimentoOrigem" TEXT,
ADD COLUMN     "waId" TEXT;

-- CreateTable
CREATE TABLE "EventoWebhook" (
    "id" SERIAL NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,
    "corpo" TEXT NOT NULL,
    "processadoEm" TIMESTAMP(3),
    "tentativas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EventoWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventoWebhook_processadoEm_criadoEm_idx" ON "EventoWebhook"("processadoEm", "criadoEm");

