-- CreateTable
CREATE TABLE "AssinaturaPush" (
    "id" SERIAL NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssinaturaPush_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssinaturaPush_endpoint_key" ON "AssinaturaPush"("endpoint");

-- CreateIndex
CREATE INDEX "AssinaturaPush_usuarioId_idx" ON "AssinaturaPush"("usuarioId");

-- AddForeignKey
ALTER TABLE "AssinaturaPush" ADD CONSTRAINT "AssinaturaPush_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
