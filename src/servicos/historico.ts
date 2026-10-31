import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";

/** Registro de quem mudou o quê (FICHA-03). Autor: "bot", "sistema" ou o nome do usuário. */
export async function registrarAlteracao(leadId: string, autor: string, descricao: string): Promise<void> {
  await db.alteracao.create({ data: { leadId, autor, descricao, criadoEm: await agora() } });
}
