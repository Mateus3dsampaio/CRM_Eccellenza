import { z } from "zod";
import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import { transferirLeads } from "@/servicos/distribuicao";

// Passa todos os leads em andamento de um consultor para outro. Só admin.
const corpo = z.object({ de: z.string().min(1), para: z.string().min(1) });

export const POST = rota(async (req: Request) => {
  const admin = await exigirUsuario("configurar");
  const { de, para } = corpo.parse(await req.json());
  return { transferidos: await transferirLeads(de, para, admin.nome) };
});
