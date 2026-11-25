// Previsão da automação (tarefa 48): QUANDO as rotinas vão agir em cada lead, para o admin acompanhar no kanban.
// Só mostra. Nada aqui muda regra: cada previsão usa as mesmas funções que movem o card (`avaliarRecuperacao`,
// `avaliarRede`, `diasParaArquivar`) e o teste de consistência (`testes/unit/previsao-automacao.test.ts`) confere
// que a ação acontece exatamente no minuto previsto e em nenhum antes. Só regra, sem banco.
import { JANELA_MS } from "./janela24h";
import { horarioDaSegunda, proximoHorarioPermitido, type EstadoRecuperacao, type RegrasRecuperacao } from "./recuperacao";
import { perdidoAutomatico, type EstadoPerdido, type RegrasArquivarPerdido } from "./arquivar-perdido";
import type { EstadoRede, RegrasRedeDeSeguranca } from "./rede-seguranca";
import { chaveDia, DIA, formatarData, formatarDiaSemana, formatarHora, HORA } from "./tempo";

const MINUTO = 60 * 1000;
const maisTarde = (a: Date, b: Date) => (a.getTime() >= b.getTime() ? a : b);

// ---------------------------------------------------------------- recuperação

export type MotivoForaRecuperacao = "desligada" | "passou_consultor" | "arquivado" | "pediu_parar" | "etapa" | "pos_venda" | "visita" | "com_consultor" | "sem_mensagem" | "vez_do_cliente" | "cliente_respondeu";
export type MotivoTravado = "primeira_fora_da_janela" | "segunda_fora_da_janela" | "envio_falhou";

export interface PassoRecuperacao {
  tipo: "primeira" | "segunda" | "perdido";
  quando: Date;
  /** Já aconteceu (está gravado no lead). */
  feito: boolean;
}

export type PrevisaoRecuperacao =
  /** `travaDepois`: o passo seguinte (a 2ª mensagem) não cabe na janela de 24h e o ciclo para: depois dele só a rede de segurança age. */
  | { tipo: "primeira" | "segunda" | "perdido"; quando: Date; passos: PassoRecuperacao[]; travaDepois: MotivoTravado | null }
  | { tipo: "travado"; motivo: MotivoTravado; passos: PassoRecuperacao[] }
  | { tipo: "fora"; motivo: MotivoForaRecuperacao };

/**
 * Próximo evento da recuperação SUPONDO que o cliente não responda. `quando` é o primeiro instante (a partir de `agora`)
 * em que `avaliarRecuperacao` passa a devolver aquela ação: respeita o horário permitido e a janela de 24h.
 * Os passos seguintes (2ª mensagem, Perdido) são projetados com as mesmas funções (`horarioDaSegunda`).
 */
export function previsaoRecuperacao(lead: EstadoRecuperacao, r: RegrasRecuperacao, agora: Date): PrevisaoRecuperacao {
  const fora = (motivo: MotivoForaRecuperacao): PrevisaoRecuperacao => ({ tipo: "fora", motivo });
  if (!r.ligado) return fora("desligada");
  if (lead.passouPorHumano) return fora("passou_consultor");
  if (lead.arquivadoEm) return fora("arquivado");
  if (lead.naoReceberEm) return fora("pediu_parar");
  if (lead.etapa === "perdido" || lead.etapa === "fechado") return fora("etapa");
  if (lead.classificacao === "pos_venda") return fora("pos_venda");
  if (lead.temVisitaFutura) return fora("visita");
  if (lead.modoAtendimento !== "bot" || lead.aguardandoHumano) return fora("com_consultor");

  const feitos: PassoRecuperacao[] = [];
  if (lead.recuperacaoPrimeiraEm) feitos.push({ tipo: "primeira", quando: lead.recuperacaoPrimeiraEm, feito: true });
  if (lead.recuperacaoSegundaEm) feitos.push({ tipo: "segunda", quando: lead.recuperacaoSegundaEm, feito: true });
  if (lead.recuperacaoFalhou) return { tipo: "travado", motivo: "envio_falhou", passos: feitos };
  if (!lead.ultimaMsgClienteEm) return fora("sem_mensagem");

  const cliente = lead.ultimaMsgClienteEm;
  const janelaFecha = cliente.getTime() + JANELA_MS;
  const perdidoApos = (ultima: Date) => new Date(ultima.getTime() + r.perdidoHoras * HORA);

  // 1ª mensagem ainda não saiu.
  if (!lead.recuperacaoPrimeiraEm) {
    if (!lead.ultimaMsgLojaEm || lead.ultimaMsgLojaEm.getTime() <= cliente.getTime()) return fora("vez_do_cliente");
    const alvo = new Date(lead.ultimaMsgLojaEm.getTime() + r.primeiraMin * MINUTO);
    const primeira = proximoHorarioPermitido(maisTarde(alvo, agora), r);
    if (primeira.getTime() >= janelaFecha) return { tipo: "travado", motivo: "primeira_fora_da_janela", passos: [] };
    const passos: PassoRecuperacao[] = [{ tipo: "primeira", quando: primeira, feito: false }];
    let travaDepois: MotivoTravado | null = null;
    let ultima = primeira;
    if (r.segundaLigada) {
      const segunda = horarioDaSegunda(primeira, cliente, r);
      if (segunda) {
        passos.push({ tipo: "segunda", quando: segunda, feito: false });
        ultima = segunda;
      } else travaDepois = "segunda_fora_da_janela";
    }
    if (!travaDepois) passos.push({ tipo: "perdido", quando: perdidoApos(ultima), feito: false });
    return { tipo: "primeira", quando: primeira, passos, travaDepois };
  }

  // 2ª mensagem ainda não saiu (e está ligada).
  if (!lead.recuperacaoSegundaEm && r.segundaLigada) {
    if (cliente.getTime() > lead.recuperacaoPrimeiraEm.getTime()) return fora("cliente_respondeu");
    const alvo = horarioDaSegunda(lead.recuperacaoPrimeiraEm, cliente, r);
    if (!alvo) return { tipo: "travado", motivo: "segunda_fora_da_janela", passos: feitos };
    const segunda = proximoHorarioPermitido(maisTarde(alvo, agora), r);
    if (segunda.getTime() >= janelaFecha) return { tipo: "travado", motivo: "segunda_fora_da_janela", passos: feitos };
    return { tipo: "segunda", quando: segunda, passos: [...feitos, { tipo: "segunda", quando: segunda, feito: false }, { tipo: "perdido", quando: perdidoApos(segunda), feito: false }], travaDepois: null };
  }

  // Só falta ir para Perdido (relógio corrido, sem horário permitido).
  const ultimaEnviada = lead.recuperacaoSegundaEm ?? lead.recuperacaoPrimeiraEm;
  if (cliente.getTime() > ultimaEnviada.getTime()) return fora("cliente_respondeu");
  const perdido = maisTarde(perdidoApos(ultimaEnviada), agora);
  return { tipo: "perdido", quando: perdido, passos: [...feitos, { tipo: "perdido", quando: perdido, feito: false }], travaDepois: null };
}

// ---------------------------------------------------------------- rede de segurança

export type MotivoForaRede = "desligada" | "passou_consultor" | "arquivado" | "etapa" | "com_consultor" | "visita" | "sem_mensagem";

export type PrevisaoRede =
  | { tipo: "perdido" | "arquivar"; quando: Date; /** O retorno marcado é o que decide a data (e não os dias sem resposta). */ seguradoPorRetorno: boolean }
  | { tipo: "fora"; motivo: MotivoForaRede };

/** Quando a rede de segurança tira o lead do quadro: o último instante entre `dias` sem mensagem do cliente e o fim do retorno marcado. */
export function previsaoRede(lead: EstadoRede, r: RegrasRedeDeSeguranca, agora: Date): PrevisaoRede {
  const fora = (motivo: MotivoForaRede): PrevisaoRede => ({ tipo: "fora", motivo });
  if (!r.ligado) return fora("desligada");
  if (lead.arquivadoEm) return fora("arquivado");
  if (lead.passouPorHumano) return fora("passou_consultor");
  if (lead.etapa === "perdido" || lead.etapa === "fechado") return fora("etapa");
  if (lead.modoAtendimento !== "bot" || lead.aguardandoHumano) return fora("com_consultor");
  if (lead.temVisitaFutura) return fora("visita");
  if (!lead.ultimaMsgClienteEm) return fora("sem_mensagem");
  const porDias = new Date(lead.ultimaMsgClienteEm.getTime() + r.dias * DIA);
  const retorno = lead.proximoContatoEm && lead.proximoContatoEm.getTime() > agora.getTime() ? lead.proximoContatoEm : null;
  const quando = maisTarde(maisTarde(porDias, agora), retorno ?? porDias);
  return { tipo: lead.classificacao === "pos_venda" ? "arquivar" : "perdido", quando, seguradoPorRetorno: !!retorno && retorno.getTime() > porDias.getTime() };
}

// ---------------------------------------------------------------- Perdido → arquivo

export type PrevisaoArquivo =
  | { tipo: "arquivo"; quando: Date; dias: number; automatico: boolean }
  | { tipo: "nao_arquiva"; motivo: "desligada" | "vendedor_desligado" }
  | { tipo: "fora" };

/** Quando o card em Perdido vai para o arquivo (mesma conta de `diasParaArquivar`). */
export function previsaoArquivo(lead: EstadoPerdido, r: RegrasArquivarPerdido, agora: Date): PrevisaoArquivo {
  if (lead.arquivadoEm || lead.etapa !== "perdido" || !lead.perdidoEm) return { tipo: "fora" };
  if (!r.ligado) return { tipo: "nao_arquiva", motivo: "desligada" };
  const automatico = perdidoAutomatico(lead.autorDaMudanca);
  if (!automatico && !r.vendedorLigado) return { tipo: "nao_arquiva", motivo: "vendedor_desligado" };
  const dias = automatico ? r.diasAutomatico : r.diasVendedor;
  return { tipo: "arquivo", quando: maisTarde(new Date(lead.perdidoEm.getTime() + dias * DIA), agora), dias, automatico };
}

// ---------------------------------------------------------------- o card

export interface RegrasDePrevisao {
  recuperacao: RegrasRecuperacao;
  rede: RegrasRedeDeSeguranca;
  arquivar: RegrasArquivarPerdido;
}

/** Tudo o que as três regras precisam saber do lead. */
export type EstadoPrevisao = EstadoRecuperacao &
  EstadoRede & {
    /** Início da próxima visita/medição/apresentação agendada (só para o texto "Visita marcada"). */
    visitaEm: Date | null;
    /** Quando o lead entrou em Perdido e quem moveu (só na coluna Perdido). */
    perdidoEm: Date | null;
    autorDaMudanca: string | null;
  };

export type TipoPrevisao = "primeira" | "segunda" | "perdido" | "arquivo" | "travado" | "protegido" | "desligada" | "sem_previsao" | "nao_arquiva";
export type MotivoProtegido = "passou_consultor" | "com_consultor" | "visita" | "retorno";

export interface PassoCard {
  rotulo: string;
  quando: Date;
  feito: boolean;
}

export interface PrevisaoCard {
  coluna: "novo" | "perdido";
  tipo: TipoPrevisao;
  /** Data do próximo evento (travado: a da rede de segurança, se houver; protegido: a da visita ou do retorno). */
  quando: Date | null;
  motivo: MotivoProtegido | MotivoTravado | null;
  passos: PassoCard[];
  /** Quantos passos da trilha (1ª mensagem, 2ª mensagem, Perdido) já foram feitos. Só a coluna IA atendendo. */
  feitos: number;
  nota: string | null;
}

const ROTULO_PASSO: Record<PassoRecuperacao["tipo"], string> = { primeira: "1ª mensagem", segunda: "2ª mensagem", perdido: "Vai para Perdido" };

function protegido(motivo: MotivoProtegido, quando: Date | null, passos: PassoCard[], nota: string | null): PrevisaoCard {
  return { coluna: "novo", tipo: "protegido", quando, motivo, passos, feitos: 0, nota };
}

/**
 * Previsão para um card da coluna IA atendendo (`novo`) ou Perdido. O próximo evento é o mais cedo entre a recuperação e
 * a rede de segurança; o Perdido final é o mais cedo dos dois. Lead que um humano tocou, visita marcada e retorno que
 * segura a rede aparecem como "protegido".
 */
export function previsaoDoCard(lead: EstadoPrevisao, regras: RegrasDePrevisao, agora: Date): PrevisaoCard {
  if (lead.etapa === "perdido") {
    const a = previsaoArquivo(lead, regras.arquivar, agora);
    const passos: PassoCard[] = lead.perdidoEm ? [{ rotulo: perdidoAutomatico(lead.autorDaMudanca) ? "Foi para Perdido (automático)" : "Foi para Perdido", quando: lead.perdidoEm, feito: true }] : [];
    if (a.tipo === "arquivo") return { coluna: "perdido", tipo: "arquivo", quando: a.quando, motivo: null, passos: [...passos, { rotulo: "Vai para o arquivo", quando: a.quando, feito: false }], feitos: 0, nota: a.automatico ? null : `Perdido marcado por uma pessoa: espera ${a.dias} dias.` };
    if (a.tipo === "nao_arquiva") return { coluna: "perdido", tipo: "nao_arquiva", quando: null, motivo: null, passos, feitos: 0, nota: a.motivo === "desligada" ? "Arquivar Perdido sozinho está desligado." : "Perdido marcado por uma pessoa não arquiva sozinho (desligado)." };
    return { coluna: "perdido", tipo: "sem_previsao", quando: null, motivo: null, passos, feitos: 0, nota: null };
  }

  const cliente: PassoCard[] = lead.ultimaMsgClienteEm ? [{ rotulo: "Cliente parou de responder", quando: lead.ultimaMsgClienteEm, feito: true }] : [];
  if (lead.passouPorHumano) return protegido("passou_consultor", null, cliente, "Um consultor já entrou nesta conversa: nenhuma rotina mexe mais nele.");
  if (lead.modoAtendimento !== "bot" || lead.aguardandoHumano) return protegido("com_consultor", null, cliente, "A conversa está com o consultor.");
  if (lead.temVisitaFutura) return protegido("visita", lead.visitaEm, cliente, "Tem compromisso marcado: as rotinas esperam.");

  const rec = previsaoRecuperacao(lead, regras.recuperacao, agora);
  const rede = previsaoRede(lead, regras.rede, agora);
  const destinoRede = rede.tipo === "arquivar" ? "o arquivo" : "Perdido";

  // Passos da recuperação já com o Perdido final (o mais cedo entre ela e a rede).
  const passosRec = rec.tipo === "primeira" || rec.tipo === "segunda" || rec.tipo === "perdido" || rec.tipo === "travado" ? rec.passos : [];
  const perdidoRec = passosRec.find((p) => p.tipo === "perdido")?.quando ?? null;
  const redeData = rede.tipo === "perdido" || rede.tipo === "arquivar" ? rede.quando : null;
  const redeAntes = !!redeData && (!perdidoRec || redeData.getTime() < perdidoRec.getTime());
  const finalQuando = redeAntes ? redeData : perdidoRec;
  const finalRotulo = redeAntes && rede.tipo === "arquivar" ? "Vai para o arquivo" : "Vai para Perdido";

  const montar = (): PassoCard[] => {
    const lista: PassoCard[] = [...cliente];
    for (const p of passosRec) if (p.tipo !== "perdido") lista.push({ rotulo: ROTULO_PASSO[p.tipo], quando: p.quando, feito: p.feito });
    if (finalQuando) lista.push({ rotulo: finalRotulo, quando: finalQuando, feito: false });
    return lista;
  };
  const feitos = passosRec.filter((p) => p.feito && p.tipo !== "perdido").length;

  // Próximo evento: mensagem da recuperação, ou o Perdido/arquivo (recuperação ou rede), o que vier primeiro.
  let proximo: { tipo: "primeira" | "segunda" | "perdido" | "arquivo"; quando: Date } | null = null;
  if (rec.tipo === "primeira" || rec.tipo === "segunda") proximo = { tipo: rec.tipo, quando: rec.quando };
  if (finalQuando && (!proximo || finalQuando.getTime() < proximo.quando.getTime())) proximo = { tipo: redeAntes && rede.tipo === "arquivar" ? "arquivo" : "perdido", quando: finalQuando };

  let nota: string | null = null;
  if (rec.tipo === "primeira" && rec.travaDepois) nota = `A 2ª mensagem não cabe na janela de 24h: depois da 1ª não sai mais nada automático.${redeData ? ` Só a rede de segurança leva o lead para ${destinoRede}.` : ""}`;
  else if (redeAntes && perdidoRec) nota = `A rede de segurança (${regras.rede.dias} dias) leva antes do prazo da recuperação.`;
  else if (rec.tipo === "fora" && rec.motivo === "vez_do_cliente" && redeData) nota = "O cliente escreveu por último: a IA ainda vai responder.";

  // Recuperação travada: o card é "Travado" (e mostra a data da rede de segurança, se ela estiver ligada).
  if (rec.tipo === "travado") {
    const semRede = rede.tipo === "fora";
    return { coluna: "novo", tipo: "travado", quando: redeData, motivo: rec.motivo, passos: montar(), feitos, nota: semRede ? "Sem mais mensagem automática e a rede de segurança está desligada: só uma pessoa tira este lead daqui." : `Sem mais mensagem automática. Só sai pela rede de segurança (${regras.rede.dias} dias).` };
  }
  if (proximo) {
    // Retorno marcado que segura a rede: o card está "protegido" até lá (só quando é o retorno que decide a data).
    if (!perdidoRec && rede.tipo !== "fora" && rede.seguradoPorRetorno && lead.proximoContatoEm && rec.tipo !== "primeira" && rec.tipo !== "segunda") {
      return protegido("retorno", lead.proximoContatoEm, montar(), "Retorno marcado: a rede de segurança espera a data.");
    }
    return { coluna: "novo", tipo: proximo.tipo, quando: proximo.quando, motivo: null, passos: montar(), feitos, nota };
  }
  if (rec.tipo === "fora" && rec.motivo === "desligada" && rede.tipo === "fora" && rede.motivo === "desligada") {
    return { coluna: "novo", tipo: "desligada", quando: null, motivo: null, passos: cliente, feitos: 0, nota: null };
  }
  return { coluna: "novo", tipo: "sem_previsao", quando: null, motivo: null, passos: cliente, feitos: 0, nota };
}

// ---------------------------------------------------------------- categoria, cor e texto

export type CategoriaPrevisao = "perdido_hoje" | "msg_hoje" | "travado" | "protegido" | "depois" | "arquiva_breve" | "arquiva_depois" | "nao_arquiva";
export type CorPrevisao = "alerta" | "aviso" | "neutra";

const ehHoje = (d: Date, agora: Date) => chaveDia(d) === chaveDia(agora);
const ehAmanha = (d: Date, agora: Date) => chaveDia(d) === chaveDia(new Date(agora.getTime() + DIA));

/** Categoria do card (uma só, pelo próximo evento) e a cor dela. Depende do dia de hoje: calcular no momento de mostrar. */
export function categoriaDaPrevisao(p: PrevisaoCard, agora: Date): { categoria: CategoriaPrevisao; cor: CorPrevisao } {
  const vence = p.quando ? p.quando.getTime() <= agora.getTime() || ehHoje(p.quando, agora) : false;
  if (p.coluna === "perdido") {
    if (p.tipo === "arquivo" && p.quando) return p.quando.getTime() <= agora.getTime() || ehHoje(p.quando, agora) || ehAmanha(p.quando, agora) ? { categoria: "arquiva_breve", cor: "alerta" } : { categoria: "arquiva_depois", cor: "neutra" };
    return { categoria: "nao_arquiva", cor: "neutra" };
  }
  if (p.tipo === "travado") return { categoria: "travado", cor: "aviso" };
  if (p.tipo === "protegido") return { categoria: "protegido", cor: "neutra" };
  if ((p.tipo === "primeira" || p.tipo === "segunda") && vence) return { categoria: "msg_hoje", cor: "aviso" };
  if ((p.tipo === "perdido" || p.tipo === "arquivo") && vence) return { categoria: "perdido_hoje", cor: "alerta" };
  return { categoria: "depois", cor: "neutra" };
}

/** "sáb 28/11". */
export function formatarDiaCurto(d: Date): string {
  return `${formatarDiaSemana(d)} ${formatarData(d).slice(0, 5)}`;
}

/** "hoje 13:00", "amanhã 10:00", "ontem 17:20" ou "sáb 28/11" (para o balão). */
export function formatarMomento(d: Date, agora: Date): string {
  if (ehHoje(d, agora)) return `hoje ${formatarHora(d)}`;
  if (ehAmanha(d, agora)) return `amanhã ${formatarHora(d)}`;
  if (chaveDia(d) === chaveDia(new Date(agora.getTime() - DIA))) return `ontem ${formatarHora(d)}`;
  return `${formatarDiaCurto(d)} ${formatarHora(d)}`;
}

export type IconeLinha = "trilha" | "alerta" | "escudo" | "arquivo";

export interface LinhaPrevisao {
  rotulo: string;
  /** Hora, dia ou vazio. */
  horario: string;
  icone: IconeLinha;
  /** Trilha de 3 marcas: quantas já foram feitas e qual é a atual (0 = 1ª mensagem, 1 = 2ª, 2 = Perdido). */
  trilha: { feitos: number; atual: number } | null;
}

/** Textos curtos da linha do card (cabem em 240 px). Nunca mostra data no passado: vencido vira "agora". */
export function linhaDaPrevisao(p: PrevisaoCard, agora: Date): LinhaPrevisao {
  const q = p.quando;
  const agoraMesmo = !!q && q.getTime() <= agora.getTime();
  const dia = q ? formatarDiaCurto(q) : "";
  const relativo = (base: string): { rotulo: string; horario: string } => {
    if (!q) return { rotulo: base, horario: "" };
    if (agoraMesmo) return { rotulo: `${base} agora`, horario: "" };
    if (ehHoje(q, agora)) return { rotulo: `${base} hoje`, horario: formatarHora(q) };
    if (ehAmanha(q, agora)) return { rotulo: `${base} amanhã`, horario: formatarHora(q) };
    return { rotulo: base, horario: dia };
  };
  switch (p.tipo) {
    case "primeira": {
      // A 1ª mensagem de hoje fica só com a hora (como no protótipo); em outro dia, com o dia.
      const l = relativo("1ª mensagem");
      return { rotulo: l.rotulo.replace(" hoje", ""), horario: l.horario, icone: "trilha", trilha: { feitos: 0, atual: 0 } };
    }
    case "segunda":
      return { ...relativo("2ª mensagem"), icone: "trilha", trilha: { feitos: 1, atual: 1 } };
    case "perdido":
      return { ...relativo("Perdido"), icone: "trilha", trilha: { feitos: p.feitos, atual: 2 } };
    case "arquivo": {
      if (p.coluna === "perdido" && q && !agoraMesmo && !ehHoje(q, agora) && !ehAmanha(q, agora)) {
        const dias = Math.max(1, Math.ceil((q.getTime() - agora.getTime()) / DIA));
        return { rotulo: `Arquivo em ${dias} dias`, horario: dia, icone: "arquivo", trilha: null };
      }
      const l = relativo("Arquivo");
      return { ...l, icone: p.coluna === "perdido" ? "arquivo" : "trilha", trilha: p.coluna === "perdido" ? null : { feitos: p.feitos, atual: 2 } };
    }
    case "travado": {
      const destino = p.passos.some((x) => x.rotulo === "Vai para o arquivo") ? "Arquivo" : "Perdido";
      return { rotulo: "Travado", horario: q ? `${destino} ${dia}` : "", icone: "alerta", trilha: null };
    }
    case "protegido": {
      const rotulo = p.motivo === "retorno" ? "Retorno marcado" : p.motivo === "visita" ? "Visita marcada" : p.motivo === "passou_consultor" ? "Passou por consultor" : "Com o consultor";
      return { rotulo, horario: (p.motivo === "retorno" || p.motivo === "visita") && q ? dia : "", icone: "escudo", trilha: null };
    }
    case "desligada":
      return { rotulo: "Automação desligada", horario: "", icone: "alerta", trilha: null };
    case "nao_arquiva":
      return { rotulo: "Não arquiva sozinho", horario: "", icone: "arquivo", trilha: null };
    default:
      return { rotulo: "Sem automação prevista", horario: "", icone: "alerta", trilha: null };
  }
}

// ---------------------------------------------------------------- JSON (a rota manda datas em ISO)

export interface PrevisaoCardJson extends Omit<PrevisaoCard, "quando" | "passos"> {
  quando: string | null;
  passos: { rotulo: string; quando: string; feito: boolean }[];
}

export function previsaoParaJson(p: PrevisaoCard): PrevisaoCardJson {
  return { ...p, quando: p.quando?.toISOString() ?? null, passos: p.passos.map((x) => ({ ...x, quando: x.quando.toISOString() })) };
}

export function previsaoDeJson(j: PrevisaoCardJson): PrevisaoCard {
  return { ...j, quando: j.quando ? new Date(j.quando) : null, passos: j.passos.map((x) => ({ ...x, quando: new Date(x.quando) })) };
}
