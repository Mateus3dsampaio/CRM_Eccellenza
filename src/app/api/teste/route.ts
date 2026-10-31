import { z } from "zod";
import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { avancarRelogio, agora } from "@/lib/relogio";
import { ErroHttp } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { HORA, formatarDataHora } from "@/regras/tempo";
import { normalizarTelefone } from "@/regras/telefone";
import { dadosDaAgenda, fichaDoLead } from "@/servicos/consultas";
import { ErroConversa, receberMensagemCliente } from "@/servicos/conversa";
import { registrarAvanco, rodarRotinas } from "@/servicos/rotinas";

export const dynamic = "force-dynamic";

// Interface programática de teste (CHAT-02), usada pelo agente cliente-simulado e por `npm run simular`.
// Só funciona em desenvolvimento, chamada do próprio computador: o servidor de desenvolvimento escuta só em 127.0.0.1
// (npm run dev), e a rota exige JSON e um cabeçalho próprio, que um site de fora não consegue enviar (sem CSRF).
const CABECALHO_TESTE = "x-crm-teste";
function exigirAmbienteDeTeste(req: Request) {
  const host = (req.headers.get("host") ?? "").replace(/:\d+$/, "");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(host);
  const json = (req.headers.get("content-type") ?? "").startsWith("application/json");
  if (process.env.NODE_ENV === "production" || !local || !json || req.headers.get(CABECALHO_TESTE) !== "simulador") {
    throw new ErroHttp(403, "Interface de teste disponível só em desenvolvimento local.");
  }
}

const esquema = z.discriminatedUnion("acao", [
  z.object({
    acao: z.literal("mensagem"),
    telefone: z.string(),
    nome: z.string().max(80).optional(),
    texto: z.string().max(4000).optional(),
    imagemBase64: z.string().max(8_000_000).optional(),
    imagemTipo: z.string().optional(),
  }),
  z.object({ acao: z.literal("lead"), telefone: z.string() }),
  z.object({ acao: z.literal("relogio"), horas: z.number().int().min(1).max(24 * 60) }),
  z.object({ acao: z.literal("agenda") }),
]);

async function leadPorTelefone(entrada: string) {
  const telefone = normalizarTelefone(entrada);
  if (!telefone) throw new ErroHttp(400, "Telefone inválido.");
  const lead = await db.lead.findUnique({ where: { telefone }, select: { id: true } });
  return lead ? fichaDoLead(lead.id) : null;
}

export const POST = rota(async (req: Request) => {
  exigirAmbienteDeTeste(req);
  const corpo = esquema.parse(await req.json());
  switch (corpo.acao) {
    case "mensagem": {
      try {
        const r = await receberMensagemCliente({
          telefone: corpo.telefone,
          nomePerfil: corpo.nome,
          texto: corpo.texto,
          imagem: corpo.imagemBase64 ? { dados: Buffer.from(corpo.imagemBase64, "base64"), tipo: corpo.imagemTipo ?? "image/png" } : null,
        });
        return { respostas: r.respostas, erro: r.erro };
      } catch (erro) {
        if (erro instanceof ErroConversa) throw new ErroHttp(400, erro.message);
        throw erro;
      }
    }
    case "lead": {
      const ficha = await leadPorTelefone(corpo.telefone);
      if (!ficha) throw new ErroHttp(404, "Lead não encontrado.");
      return ficha;
    }
    case "relogio": {
      const novo = await avancarRelogio(corpo.horas * HORA);
      await registrarAvanco(`Relógio avançado ${corpo.horas} hora(s) pela interface de teste: agora é ${formatarDataHora(novo)}.`);
      const resultado = await rodarRotinas();
      await marcarMudanca();
      return { agora: (await agora()).toISOString(), resultado };
    }
    case "agenda": {
      const quando = await agora();
      return dadosDaAgenda(quando, new Date(quando.getTime() + 20 * 24 * HORA));
    }
  }
});
