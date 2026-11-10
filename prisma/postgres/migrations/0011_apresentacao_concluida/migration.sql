-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "pulouMedicaoEm" TIMESTAMP(3),
ADD COLUMN "estimativaAlinhadaEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Visita" ADD COLUMN "concluidaEm" TIMESTAMP(3);
