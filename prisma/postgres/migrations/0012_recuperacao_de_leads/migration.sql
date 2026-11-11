-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "recuperacaoPrimeiraEm" TIMESTAMP(3),
ADD COLUMN "recuperacaoSegundaEm" TIMESTAMP(3),
ADD COLUMN "recuperacaoFalhou" BOOLEAN NOT NULL DEFAULT false;
