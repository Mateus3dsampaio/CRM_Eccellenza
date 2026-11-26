"use client";

import { ArrowDown, ArrowUp, BookOpen, Download, FileUp, FlaskConical, History, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { planejarImportacao, type ItemDoPlano } from "@/regras/importar-instrucoes";
import { chamarApi, useAviso, useDados } from "../dados";
import { juntar } from "../estilos";
import { Botao, Campo, Carregando, classeEntrada, EstadoErro, Modal } from "../ui";

interface Instrucao {
  id: string;
  titulo: string;
  texto: string;
  ordem: number;
  ativa: boolean;
  anteriorTitulo: string | null;
  anteriorTexto: string | null;
}

/** O texto original começa com "01. TÍTULO"; no resumo do cartão essa linha só repetiria o título. */
function resumo(texto: string): string {
  const [primeira, ...resto] = texto.split(/\r?\n/);
  return /^\s*\d+\s*[.)-]\s*\S/.test(primeira) && resto.length > 0 ? resto.join("\n").trim() : texto;
}

// `manual`: editando o Manual do CRM (título fixo).
type Edicao = { id: string | null; titulo: string; texto: string; manual?: boolean };

export function InstrucoesAtendimento() {
  const avisar = useAviso();
  const { dados, erro, carregando, recarregar } = useDados<{ instrucoes: Instrucao[]; manual: Instrucao; manualSituacao: "igual" | "voltou" | "desatualizado" | "editado"; iaLigada: boolean }>("/api/configuracoes/instrucoes");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [salvouAgora, setSalvouAgora] = useState(false);
  const aviso = useRef<HTMLParagraphElement>(null);
  const [desativando, setDesativando] = useState<Instrucao | null>(null);
  const [excluindo, setExcluindo] = useState<Instrucao | null>(null);
  // Importar de arquivos .txt: o seletor do Windows deixa marcar vários; antes de gravar mostra o que vai acontecer com cada um.
  const seletor = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<{ nome: string; texto: string }[] | null>(null);
  const [importando, setImportando] = useState(false);

  async function lerArquivos(lista: FileList | null) {
    if (!lista?.length) return;
    const lidos = await Promise.all(Array.from(lista).map(async (f) => ({ nome: f.name, texto: await f.text() })));
    setArquivos(lidos);
    if (seletor.current) seletor.current.value = ""; // deixa escolher os mesmos arquivos de novo depois
  }

  const plano: ItemDoPlano[] = arquivos ? planejarImportacao(arquivos, dados?.instrucoes ?? []) : [];
  const algumErro = plano.some((p) => p.acao === "erro");
  const algoParaGravar = plano.some((p) => p.acao === "nova" || p.acao === "atualizar");

  async function confirmarImportacao() {
    if (!arquivos) return;
    setImportando(true);
    let ok = false;
    try {
      const r = await chamarApi<{ atualizadas: number; novas: number; iguais: number }>("/api/configuracoes/instrucoes/importar", { method: "POST", json: { arquivos } });
      avisar(`Importado: ${r.atualizadas} atualizada(s), ${r.novas} nova(s)${r.iguais ? `, ${r.iguais} sem mudança` : ""}. O bot já usa os novos textos.`);
      setSalvouAgora(true);
      ok = true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível importar.", "erro");
    } finally {
      await recarregar();
    }
    setImportando(false);
    if (ok) setArquivos(null);
  }

  // `mudaBot`: a ação muda o que o bot diz; mostra o atalho para testar no simulador.
  async function agir(fn: () => Promise<unknown>, sucesso: string, mudaBot = false) {
    try {
      await fn();
      avisar(sucesso);
      if (mudaBot) setSalvouAgora(true);
      return true;
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível salvar.", "erro");
      return false;
    } finally {
      await recarregar();
    }
  }

  const [mudandoIa, setMudandoIa] = useState(false);
  async function mudarIa(ligada: boolean) {
    setMudandoIa(true);
    await agir(() => chamarApi("/api/configuracoes/instrucoes", { method: "PUT", json: { ligada } }), ligada ? "Atendimento da IA ligado." : "Atendimento da IA desligado. Mensagens novas vão para o consultor.");
    setMudandoIa(false);
  }

  useEffect(() => {
    if (confirmando) aviso.current?.scrollIntoView({ block: "nearest" });
  }, [confirmando]);

  function fecharEdicao() {
    setEdicao(null);
    setConfirmando(false);
  }

  async function salvar() {
    if (!edicao) return;
    setSalvando(true);
    const corpo = { titulo: edicao.titulo, texto: edicao.texto };
    const ok = await agir(
      () => (edicao.id ? chamarApi(`/api/configuracoes/instrucoes/${edicao.id}`, { method: "PATCH", json: corpo }) : chamarApi("/api/configuracoes/instrucoes", { method: "POST", json: corpo })),
      edicao.manual ? "Manual do CRM salvo. O bot já usa o novo texto na próxima mensagem." : "Instrução salva. O bot já usa o novo texto na próxima mensagem.",
      true,
    );
    setSalvando(false);
    if (ok) fecharEdicao();
    else setConfirmando(false);
  }

  function mover(indice: number, delta: -1 | 1) {
    if (!dados) return;
    const ids = dados.instrucoes.map((i) => i.id);
    const destino = indice + delta;
    if (destino < 0 || destino >= ids.length) return;
    [ids[indice], ids[destino]] = [ids[destino], ids[indice]];
    void agir(() => chamarApi("/api/configuracoes/instrucoes/reordenar", { method: "PUT", json: { ids } }), "Ordem atualizada.", true);
  }

  const instrucoes = dados?.instrucoes ?? [];
  const manual = dados?.manual ?? null;
  const ativas = instrucoes.filter((i) => i.ativa).length;

  return (
    <section className="space-y-3" aria-label="Instruções de atendimento">
      <Modal aberto={arquivos !== null} aoFechar={() => !importando && setArquivos(null)} titulo="Importar instruções" largura="max-w-2xl">
        <p className="text-sm text-texto-suave">O título vem da primeira linha de cada arquivo e o número, do começo do texto. Confira antes de importar: o bot passa a usar os novos textos na próxima mensagem.</p>
        <ul className="mt-3 max-h-[50dvh] space-y-1.5 overflow-y-auto">
          {plano.map((p) => (
            <li key={p.lida.nome} className="flex items-start gap-3 rounded-controle border border-borda bg-superficie-suave/40 px-3 py-2 text-sm">
              <span className="w-7 shrink-0 pt-0.5 text-right font-semibold tabular-nums text-marca-texto">{p.lida.numero !== null ? String(p.lida.numero).padStart(2, "0") : "–"}</span>
              <span className="min-w-0 flex-1">
                <span className="block break-words font-medium">{p.lida.titulo || p.lida.nome}</span>
                <span className="block truncate text-xs text-texto-fraco">{p.lida.nome}</span>
                {p.lida.erro && <span className="block text-xs text-alerta">{p.lida.erro}</span>}
                {p.acao === "atualizar" && p.tituloAtual !== p.lida.titulo && <span className="block text-xs text-texto-suave">Título atual: {p.tituloAtual}</span>}
              </span>
              <span
                className={juntar(
                  "shrink-0 rounded-pilula px-2 py-0.5 text-xs font-medium",
                  p.acao === "nova" && "bg-sucesso-suave text-sucesso",
                  p.acao === "atualizar" && "bg-marca-suave text-marca-texto",
                  p.acao === "igual" && "bg-superficie-suave text-texto-suave",
                  p.acao === "erro" && "bg-alerta-suave text-alerta",
                )}
              >
                {p.acao === "nova" ? "Nova" : p.acao === "atualizar" ? "Atualiza" : p.acao === "igual" ? "Sem mudança" : "Com erro"}
              </span>
            </li>
          ))}
        </ul>
        {algumErro && <p className="mt-3 text-sm text-alerta">Há arquivo com erro. Corrija ou tire da seleção e escolha de novo: nada é importado enquanto houver erro.</p>}
        {!algumErro && !algoParaGravar && <p className="mt-3 text-sm text-texto-suave">Todos os arquivos já estão iguais às instruções do sistema.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setArquivos(null)} disabled={importando}>
            Cancelar
          </Botao>
          <Botao variante="primario" disabled={algumErro || !algoParaGravar} carregando={importando} onClick={() => void confirmarImportacao()}>
            Importar
          </Botao>
        </div>
      </Modal>
      <div className="rounded-painel border border-borda bg-superficie p-5 luz-marca-fio">
        <h2 className="font-semibold">Instruções de atendimento do bot</h2>
        <p className="mt-1 text-sm text-texto-suave">
          O bot segue as instruções numeradas, na ordem da lista, e depois o Manual do CRM (como preencher a ficha e usar as ferramentas). Mudou aqui, o bot já atende diferente na próxima mensagem. Só o administrador edita.
        </p>
        {dados && (
          <div className={juntar("mt-3 flex flex-wrap items-center justify-between gap-3 rounded-controle border px-4 py-3", dados.iaLigada ? "border-borda bg-superficie-suave/40" : "border-aviso bg-aviso-suave")}>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold">{dados.iaLigada ? "Atendimento da IA ligado" : "Atendimento da IA desligado"}</p>
              <p className={dados.iaLigada ? "text-texto-suave" : "text-aviso"}>
                {dados.iaLigada
                  ? "O bot responde os clientes que escrevem."
                  : "O bot não responde ninguém: toda mensagem nova passa direto para o consultor, que atende no lugar. Quem já passou ao consultor continua com ele."}
              </p>
            </div>
            <label className="flex min-h-toque cursor-pointer items-center gap-3 text-sm font-medium">
              <input
                type="checkbox"
                className="interruptor"
                checked={dados.iaLigada}
                disabled={mudandoIa}
                aria-label="Atendimento da IA"
                onChange={(e) => void mudarIa(e.target.checked)}
              />
              {dados.iaLigada ? "Ligado" : "Desligado"}
            </label>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Botao variante="primario" icone={<Plus className="size-4" aria-hidden />} onClick={() => { setSalvouAgora(false); setEdicao({ id: null, titulo: "", texto: "" }); }}>
            Nova instrução
          </Botao>
          <input ref={seletor} type="file" multiple accept=".txt,text/plain" className="sr-only" tabIndex={-1} aria-label="Escolher arquivos de instruções" onChange={(e) => void lerArquivos(e.target.files)} />
          <Botao icone={<FileUp className="size-4" aria-hidden />} onClick={() => seletor.current?.click()}>
            Importar
          </Botao>
          <Botao icone={<Download className="size-4" aria-hidden />} onClick={() => setExportando(true)} disabled={!manual}>
            Exportar
          </Botao>
          <Link
            href="/simulador"
            className="inline-flex min-h-toque items-center justify-center gap-2 rounded-controle border border-borda bg-superficie px-4 text-sm font-medium shadow-card transition hover:border-borda-forte hover:bg-superficie-suave"
          >
            <FlaskConical className="size-4" aria-hidden /> Testar no simulador
          </Link>
          {dados && (
            <span className="ml-auto text-xs text-texto-fraco">
              {ativas} de {instrucoes.length} ativas
            </span>
          )}
        </div>
        {salvouAgora && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-controle bg-sucesso-suave px-3 py-2 text-sm text-sucesso">
            Salvo. Vale a pena conversar no simulador antes de depender da mudança.
            <Link href="/simulador" className="font-semibold underline">
              Testar no simulador
            </Link>
          </p>
        )}
      </div>

      {carregando && !dados ? (
        <Carregando linhas={4} />
      ) : erro && !dados ? (
        <EstadoErro texto={erro} aoTentar={recarregar} />
      ) : (
        <ul className="space-y-2">
          {ativas === 0 && (
            <li role="alert" className="flex items-start gap-3 rounded-painel border border-aviso bg-aviso-suave p-4 text-sm text-aviso">
              <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden />
              <span>
                <strong className="block font-semibold">{instrucoes.length === 0 ? "Cole as instruções de atendimento para o bot começar a atender." : "Nenhuma instrução ativa."}</strong>
                Enquanto não houver instrução ativa, o bot não responde: todo cliente novo vai direto para o consultor. Use &quot;Nova instrução&quot; e cole cada uma do seu repositório de instruções.
              </span>
            </li>
          )}
          {instrucoes.map((i, n) => (
            <li key={i.id} className={juntar("rounded-painel border bg-superficie p-4 shadow-card transition", i.ativa ? "border-borda" : "border-dashed border-borda-forte opacity-70")}>
              <div className="flex items-start gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-pilula bg-marca-suave text-sm font-semibold text-marca-texto">{n + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {i.titulo}
                    {!i.ativa && <span className="rounded-pilula bg-superficie-suave px-2 py-0.5 text-xs font-normal text-texto-suave">Desativada</span>}
                  </p>
                  <p className="mt-1 line-clamp-2 whitespace-pre-line text-sm text-texto-suave">{resumo(i.texto)}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-borda pt-3 text-sm">
                <label className="mr-auto inline-flex min-h-toque cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    className="interruptor"
                    checked={i.ativa}
                    onChange={(e) =>
                      e.target.checked
                        ? void agir(() => chamarApi(`/api/configuracoes/instrucoes/${i.id}`, { method: "PATCH", json: { ativa: true } }), "Instrução ativada.", true)
                        : setDesativando(i)
                    }
                  />
                  Ativa
                </label>
                {i.anteriorTexto !== null && (
                  <Botao
                    variante="fantasma"
                    icone={<History className="size-4" aria-hidden />}
                    onClick={() => void agir(() => chamarApi(`/api/configuracoes/instrucoes/${i.id}/voltar`, { method: "POST" }), "Voltou para a versão anterior.", true)}
                  >
                    Voltar para a anterior
                  </Botao>
                )}
                  <button
                    aria-label={`Subir ${i.titulo}`}
                    disabled={n === 0}
                    onClick={() => mover(n, -1)}
                    className="botao-icone"
                  >
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button
                    aria-label={`Descer ${i.titulo}`}
                    disabled={n === instrucoes.length - 1}
                    onClick={() => mover(n, 1)}
                    className="botao-icone"
                  >
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <Botao variante="fantasma" icone={<Pencil className="size-4" aria-hidden />} onClick={() => { setSalvouAgora(false); setEdicao({ id: i.id, titulo: i.titulo, texto: i.texto }); }}>
                    Editar
                  </Botao>
                  <Botao variante="fantasma" className="text-alerta hover:text-alerta" icone={<Trash2 className="size-4" aria-hidden />} onClick={() => setExcluindo(i)} aria-label={`Excluir ${i.titulo}`}>
                    Excluir
                  </Botao>
              </div>
            </li>
          ))}
        </ul>
      )}

      {manual && (
        <section aria-label="Manual do CRM" className="rounded-painel border border-marca/40 bg-superficie p-4 shadow-card">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-pilula bg-marca text-sobre-marca">
              <BookOpen className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {manual.titulo}
                <span className="rounded-pilula bg-marca-suave px-2 py-0.5 text-xs font-normal text-marca-texto">Fixo · fora da numeração</span>
              </p>
              <p className="mt-1 text-xs text-texto-fraco">Ensina o bot a preencher a ficha, classificar o lead e passar ao consultor. Vai para o bot depois das instruções numeradas. Não pode ser desativado nem excluído.</p>
              <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-texto-suave">{manual.texto.split(/\r?\n/).slice(1).join("\n").trim()}</p>
            </div>
          </div>
          {(dados?.manualSituacao === "editado" || dados?.manualSituacao === "voltou") && (
            <div role="alert" className="mt-3 flex flex-wrap items-start gap-2 rounded-controle bg-aviso-suave px-3 py-2 text-sm text-aviso">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p className="min-w-0 flex-1">
                O Manual daqui está diferente do texto do código do CRM. O bot usa o daqui, mas o Manual só deve mudar junto com o código: assim
                as novas versões chegam sozinhas. Enquanto estiver diferente, as atualizações do código não são aplicadas.
              </p>
              <Botao
                variante="fantasma"
                onClick={() => void agir(() => chamarApi("/api/configuracoes/instrucoes/manual-do-codigo", { method: "POST" }), "Manual do CRM igual ao do código. O texto anterior ficou guardado.", true)}
              >
                Usar o texto do código
              </Botao>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-borda pt-3 text-sm">
            {manual.anteriorTexto !== null && (
              <Botao
                variante="fantasma"
                icone={<History className="size-4" aria-hidden />}
                onClick={() => void agir(() => chamarApi(`/api/configuracoes/instrucoes/${manual.id}/voltar`, { method: "POST" }), "Manual do CRM voltou para a versão anterior.", true)}
              >
                Voltar para a anterior
              </Botao>
            )}
            <Botao variante="fantasma" icone={<Pencil className="size-4" aria-hidden />} onClick={() => { setSalvouAgora(false); setEdicao({ id: manual.id, titulo: manual.titulo, texto: manual.texto, manual: true }); }}>
              Editar
            </Botao>
          </div>
        </section>
      )}

      <Modal aberto={!!edicao} aoFechar={fecharEdicao} titulo={edicao?.manual ? "Editar Manual do CRM" : edicao?.id ? "Editar instrução" : "Nova instrução"} largura="max-w-2xl">
        {edicao && (
          <div className="space-y-3">
            {!edicao.manual && (
              <Campo rotulo="Título">
                <input className={classeEntrada} value={edicao.titulo} maxLength={120} disabled={confirmando} onChange={(e) => setEdicao({ ...edicao, titulo: e.target.value })} placeholder="Ex.: Cliente pergunta sobre garantia" />
              </Campo>
            )}
            <Campo rotulo="Texto da instrução" dica="Escreva como se estivesse orientando uma pessoa nova na loja. Este texto vai inteiro para o bot.">
              <textarea disabled={confirmando} className={juntar(classeEntrada, "h-48 resize-y font-mono sm:h-72 leading-relaxed")} value={edicao.texto} onChange={(e) => setEdicao({ ...edicao, texto: e.target.value })} />
            </Campo>
            {confirmando && (
              <p ref={aviso} className="flex items-start gap-2 rounded-controle bg-aviso-suave px-3 py-2 text-sm text-aviso" role="alert">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Isto muda como o bot atende a partir da próxima mensagem, inclusive o que ele diz ao cliente. A versão atual fica guardada como &quot;anterior&quot;.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Botao variante="fantasma" onClick={fecharEdicao}>
                Cancelar
              </Botao>
              {confirmando ? (
                <Botao variante="primario" carregando={salvando} onClick={salvar}>
                  Confirmar e salvar
                </Botao>
              ) : (
                <Botao variante="primario" disabled={!edicao.titulo.trim() || !edicao.texto.trim()} onClick={() => setConfirmando(true)}>
                  Salvar
                </Botao>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal aberto={!!desativando} aoFechar={() => setDesativando(null)} titulo="Desativar instrução?">
        <p className="text-sm text-texto-suave">
          Sem a instrução &quot;{desativando?.titulo}&quot;, o bot deixa de segui-la a partir da próxima mensagem. Você pode ativar de novo quando quiser.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setDesativando(null)}>
            Cancelar
          </Botao>
          <Botao
            variante="primario"
            onClick={() => {
              const alvo = desativando;
              setDesativando(null);
              if (alvo) void agir(() => chamarApi(`/api/configuracoes/instrucoes/${alvo.id}`, { method: "PATCH", json: { ativa: false } }), "Instrução desativada. O bot não a usa mais.", true);
            }}
          >
            Desativar
          </Botao>
        </div>
      </Modal>

      <Modal aberto={!!excluindo} aoFechar={() => setExcluindo(null)} titulo="Excluir instrução?">
        <p className="text-sm text-texto-suave">
          A instrução &quot;{excluindo?.titulo}&quot; será apagada de vez, junto com a versão anterior dela. Não dá para desfazer. Se quiser guardar o texto, use Exportar antes. Para só tirar do bot por um tempo, prefira desativar.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Botao variante="fantasma" onClick={() => setExcluindo(null)}>
            Cancelar
          </Botao>
          <Botao
            variante="perigo"
            onClick={() => {
              const alvo = excluindo;
              setExcluindo(null);
              if (alvo) void agir(() => chamarApi(`/api/configuracoes/instrucoes/${alvo.id}`, { method: "DELETE" }), "Instrução excluída.", true);
            }}
          >
            Excluir de vez
          </Botao>
        </div>
      </Modal>

      <ExportarInstrucoes aberto={exportando} aoFechar={() => setExportando(false)} instrucoes={manual ? [...instrucoes, manual] : instrucoes} />
    </section>
  );
}

function ExportarInstrucoes({ aberto, aoFechar, instrucoes }: { aberto: boolean; aoFechar: () => void; instrucoes: Instrucao[] }) {
  const avisar = useAviso();
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [formato, setFormato] = useState<"txt" | "zip">("zip");
  const [baixando, setBaixando] = useState(false);
  const todas = instrucoes.length > 0 && instrucoes.every((i) => marcadas.has(i.id));

  async function baixar() {
    setBaixando(true);
    try {
      const resposta = await fetch("/api/configuracoes/instrucoes/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: instrucoes.filter((i) => marcadas.has(i.id)).map((i) => i.id), formato }),
      });
      if (!resposta.ok) throw new Error((await resposta.json().catch(() => ({}))).erro ?? "Não foi possível exportar.");
      const arquivo = /filename="([^"]+)"/.exec(resposta.headers.get("Content-Disposition") ?? "")?.[1] ?? `instrucoes.${formato}`;
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = arquivo;
      link.click();
      URL.revokeObjectURL(url);
      avisar("Exportação pronta.");
      aoFechar();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível exportar.", "erro");
    } finally {
      setBaixando(false);
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Exportar instruções" largura="max-w-xl">
      <div className="space-y-4">
        <div>
          <label className="mb-2 inline-flex min-h-toque cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 accent-[var(--color-marca)]" checked={todas} onChange={() => setMarcadas(todas ? new Set() : new Set(instrucoes.map((i) => i.id)))} />
            Selecionar todas
          </label>
          <ul className="max-h-64 divide-y divide-borda overflow-y-auto rounded-controle border border-borda">
            {instrucoes.map((i, n) => (
              <li key={i.id}>
                <label className="flex min-h-toque cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-superficie-suave">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--color-marca)]"
                    checked={marcadas.has(i.id)}
                    onChange={() =>
                      setMarcadas((m) => {
                        const novo = new Set(m);
                        if (!novo.delete(i.id)) novo.add(i.id);
                        return novo;
                      })
                    }
                  />
                  {i.ordem > 0 && <span className="text-texto-fraco">{n + 1}.</span>} {i.titulo}
                  {!i.ativa && <span className="text-xs text-texto-fraco">(desativada)</span>}
                </label>
              </li>
            ))}
          </ul>
        </div>
        <fieldset className="space-y-1">
          <legend className="mb-1 text-sm font-medium">Formato</legend>
          {(
            [
              ["zip", "Arquivo .zip, com um .txt por instrução"],
              ["txt", "Um único arquivo .txt com todas as escolhidas"],
            ] as const
          ).map(([codigo, rotulo]) => (
            <label key={codigo} className="flex min-h-toque cursor-pointer items-center gap-2 text-sm">
              <input type="radio" name="formato-exportar" className="size-4 accent-[var(--color-marca)]" checked={formato === codigo} onChange={() => setFormato(codigo)} />
              {rotulo}
            </label>
          ))}
        </fieldset>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="mr-auto text-xs text-texto-fraco">{marcadas.size} selecionada(s)</span>
          <Botao variante="fantasma" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" carregando={baixando} disabled={marcadas.size === 0} icone={<Download className="size-4" aria-hidden />} onClick={baixar}>
            Baixar
          </Botao>
        </div>
      </div>
    </Modal>
  );
}
