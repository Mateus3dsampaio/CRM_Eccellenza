import { CLASSIFICACOES, type Classificacao } from "@/regras/etapas";
import { formatarVisitaCurta } from "@/regras/tempo";

// Resumo para o consultor (FICHA-02), no formato de docs/requisitos.md.
export interface DadosResumo {
  nome: string | null;
  nomePerfil: string | null;
  cidade: string | null;
  situacaoImovel: string | null;
  prazo: string | null;
  ambientes: string[];
  exigencias: string[];
  pedidosTecnicos: string[];
  investimento: string | null;
  classificacao: string | null;
  observacoes?: string | null;
  medidas: { ambiente: string; descricao: string; fonte: string; confirmada: boolean }[];
  /** Próximo compromisso marcado (tipo: "Visita à loja", "Medição" ou "Apresentação"). */
  visita: { inicio: Date; consultorNome: string; tipo?: string } | null;
}

const FONTE: Record<string, string> = { texto: "por texto", foto: "foto enviada", planta: "planta enviada", audio: "áudio" };

export function gerarResumo(d: DadosResumo): string {
  const nome = d.nome || d.nomePerfil || "Cliente sem nome";
  const situacao = [d.situacaoImovel, d.prazo].filter(Boolean).join(", ");
  const linha1 = [nome, d.cidade || "cidade não informada", situacao || "situação do imóvel não informada"].join(" – ");

  const ambientesComMedida = new Set(d.medidas.map((m) => m.ambiente.toLowerCase()));
  const medidas = d.medidas.map(
    (m) => `${m.ambiente} ${m.descricao} (${FONTE[m.fonte] ?? m.fonte}, ${m.confirmada ? "confirmada" : "a confirmar"})`,
  );
  const semMedida = d.ambientes.filter((a) => !ambientesComMedida.has(a.toLowerCase()));
  if (semMedida.length && medidas.length) medidas.push(`${semMedida.join(", ")} sem medida`);

  const classificacao = d.classificacao ? (CLASSIFICACOES[d.classificacao as Classificacao] ?? d.classificacao).toLowerCase() : "não classificado";

  return [
    linha1,
    `Ambientes: ${d.ambientes.join(", ") || "não informado"}`,
    `Medidas: ${medidas.length ? medidas.join("; ") : "sem medida"}`,
    `Exigências: ${d.exigencias.join(", ") || "nenhuma informada"}`,
    `Pedido técnico: ${d.pedidosTecnicos.length ? d.pedidosTecnicos.map((p) => `"${p}"`).join("; ") : "nenhum"}`,
    `Investimento: ${d.investimento ? `informou ${d.investimento}` : "não informado"}`,
    `Agenda: ${d.visita ? `${d.visita.tipo ?? "Visita"} ${formatarVisitaCurta(d.visita.inicio)} com ${d.visita.consultorNome}` : "nada marcado"}`,
    `Classificação: ${classificacao}`,
    // Observações só quando houver (motivo do contato nos casos que vão direto ao consultor).
    ...(d.observacoes ? [`Observações: ${d.observacoes}`] : []),
  ].join("\n");
}
