import { PrismaClient } from "@prisma/client";

// Uma instância só, mesmo com o recarregamento do Next em desenvolvimento.
// Os testes automáticos usam um banco separado (CRM_BANCO_TESTE), para não mexer nos dados do simulador.
const global = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  global.prisma ??
  new PrismaClient(process.env.CRM_BANCO_TESTE ? { datasources: { db: { url: process.env.CRM_BANCO_TESTE } } } : undefined);
if (process.env.NODE_ENV !== "production") global.prisma = db;
