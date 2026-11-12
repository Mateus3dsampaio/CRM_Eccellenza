-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "respondeuSemEsperaEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Mensagem" ADD COLUMN "dispensadaEm" TIMESTAMP(3),
ADD COLUMN "dispensadaPor" TEXT;
