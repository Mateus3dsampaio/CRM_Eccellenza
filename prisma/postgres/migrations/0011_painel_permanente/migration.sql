-- AlterTable
ALTER TABLE "MotivoPerda" ADD COLUMN "naoELead" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LeadExcluidoMetrica" (
    "id" TEXT NOT NULL,
    "consultorId" TEXT,
    "etapa" TEXT NOT NULL,
    "motivoPerda" TEXT,
    "naoELead" BOOLEAN NOT NULL DEFAULT false,
    "concorrente" TEXT,
    "valorFechado" INTEGER,
    "encerradoEm" TIMESTAMP(3),
    "medicaoMarcadaEm" TIMESTAMP(3),
    "apresentacaoMarcadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadExcluidoMetrica_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadExcluidoMetrica_encerradoEm_idx" ON "LeadExcluidoMetrica"("encerradoEm");

-- Cards que já estão em Perdido deixam de contar como "esperando resposta".
UPDATE "Lead" SET "aguardandoHumano" = false, "esperandoDesde" = NULL, "naoLidas" = 0, "erroBot" = NULL WHERE "etapa" = 'perdido';
