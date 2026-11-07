import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agora } from "@/lib/relogio";
import { HORA } from "@/regras/tempo";
import { janelasAbertas } from "@/servicos/consultas";
import { criarConsultores, limparBanco } from "./ajuda";

describe("janelasAbertas (tarefa 37)", () => {
  beforeEach(limparBanco);

  it("traz só janela aberta em etapa aberta; consultor vê os dele, admin vê todos", async () => {
    const [a, b] = await criarConsultores();
    const agoraTeste = await agora();
    const criar = (telefone: string, etapa: string, horasAtras: number | null, consultorId: string | null, extra: object = {}) =>
      db.lead.create({
        data: { telefone, etapa, consultorId, criadoEm: agoraTeste, ultimaMsgClienteEm: horasAtras === null ? null : new Date(agoraTeste.getTime() - horasAtras * HORA), ...extra },
      });
    const dele = await criar("+5588900000001", "qualificacao", 23, a.id);
    await criar("+5588900000002", "qualificacao", 23, b.id);
    await criar("+5588900000003", "qualificacao", 25, a.id); // fechada
    await criar("+5588900000004", "perdido", 23, a.id); // etapa encerrada
    await criar("+5588900000005", "fechado", 23, a.id);
    await criar("+5588900000006", "qualificacao", null, a.id); // cliente nunca escreveu
    await criar("+5588900000007", "qualificacao", 23, a.id, { arquivadoEm: agoraTeste });

    expect((await janelasAbertas({ id: a.id, perfil: "consultor" })).map((l) => l.id)).toEqual([dele.id]);
    expect(await janelasAbertas({ id: "qualquer", perfil: "admin" })).toHaveLength(2);
  });
});
