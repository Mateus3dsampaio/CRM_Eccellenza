"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Info, Send } from "lucide-react";
import { ORIGENS_CONSENTIMENTO } from "@/regras/consentimento";
import { MODELOS } from "@/regras/modelos";
import { normalizarTelefone, formatarTelefone } from "@/regras/telefone";
import { chamarApi, useAviso, useDados } from "./dados";
import { juntar } from "./estilos";
import { Botao, Campo, classeEntrada, Modal, StatusMensagem } from "./ui";
import type { FichaLead } from "@/servicos/consultas";

interface Consulta {
  valido: boolean;
  telefone?: string;
  lead?: { id: string; nome: string } | null;
  janelaAberta?: boolean;
  naoReceber?: boolean;
  temConsentimento?: boolean;
}

// Nova mensagem para qualquer número, sem contato salvo (MSG-01 a MSG-04). Sempre um número por vez.
export function NovaMensagem({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const avisar = useAviso();
  const [telefone, setTelefone] = useState("");
  const [consulta, setConsulta] = useState<Consulta | null>(null);
  const [texto, setTexto] = useState("");
  const [modelo, setModelo] = useState("");
  const [consentimento, setConsentimento] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<{ leadId: string; mensagemId: string } | null>(null);

  const formatoOk = normalizarTelefone(telefone) !== null;
  const livre = !!consulta?.janelaAberta;
  const bloqueado = !!consulta?.naoReceber; // pediu para parar: nenhum modelo
  const precisaConsentimento = !!modelo && !consulta?.temConsentimento && !bloqueado;

  useEffect(() => {
    if (!formatoOk) return;
    const id = setTimeout(async () => {
      try {
        setConsulta(await chamarApi<Consulta>(`/api/nova-mensagem?telefone=${encodeURIComponent(telefone)}`));
      } catch {
        setConsulta(null);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [telefone, formatoOk]);

  function limpar() {
    setTelefone("");
    setConsulta(null);
    setTexto("");
    setModelo("");
    setConsentimento("");
    setEnviado(null);
  }

  async function enviar() {
    setEnviando(true);
    try {
      const r = await chamarApi<{ leadId: string; mensagemId: string }>("/api/nova-mensagem", {
        method: "POST",
        json: { telefone, texto: livre && !modelo ? texto : undefined, modelo: modelo || undefined, consentimento: precisaConsentimento && consentimento ? consentimento : undefined },
      });
      setEnviado(r);
      avisar("Mensagem enviada (simulada).");
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível enviar.", "erro");
    } finally {
      setEnviando(false);
    }
  }

  const podeEnviar = formatoOk && consulta?.valido && ((modelo && !bloqueado && (!precisaConsentimento || consentimento)) || (!modelo && livre && texto.trim()));

  return (
    <Modal
      aberto={aberta}
      aoFechar={() => {
        limpar();
        aoFechar();
      }}
      titulo="Nova mensagem"
    >
      {enviado ? (
        <Enviado {...enviado} aoNova={limpar} />
      ) : (
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-controle border border-whatsapp/40 bg-whatsapp-suave px-3 py-2 text-sm font-medium text-sucesso">
            <span className="size-2 rounded-full bg-whatsapp" aria-hidden /> WhatsApp (simulado)
          </div>
          <Campo rotulo="Para" dica="Com DDI e DDD. Ex.: +55 88 99999-1234. Não precisa ter o contato salvo.">
            <input
              className={juntar(classeEntrada, telefone && !formatoOk && "border-alerta")}
              inputMode="tel"
              placeholder="+55 88 99999-1234"
              value={telefone}
              onChange={(e) => {
                setTelefone(e.target.value);
                if (!normalizarTelefone(e.target.value)) setConsulta(null);
              }}
              aria-invalid={!!telefone && !formatoOk}
            />
          </Campo>
          {telefone && !formatoOk && <p className="text-sm text-alerta">Número em formato inválido.</p>}
          {formatoOk && consulta?.valido && (
            <p className="text-sm text-texto-suave">
              {consulta.lead ? (
                <>
                  Contato já existe: <strong className="text-texto">{consulta.lead.nome}</strong>.
                </>
              ) : (
                <>Contato novo: o lead será criado ao enviar ({formatarTelefone(consulta.telefone!)}).</>
              )}
            </p>
          )}

          {formatoOk && consulta?.valido && !livre && (
            <div className="flex gap-2 rounded-controle bg-aviso-suave p-3 text-sm text-aviso">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <strong>Texto livre bloqueado.</strong> Pela regra da Meta, só dá para escrever livremente até 24h depois da última mensagem do cliente.
                {consulta.lead ? " Esse prazo já passou" : " Esse número nunca falou com a loja"}: escolha um modelo aprovado abaixo.
              </p>
            </div>
          )}

          {bloqueado && (
            <div className="flex gap-2 rounded-controle bg-alerta-suave p-3 text-sm text-alerta">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                <strong>Este cliente pediu para parar de receber mensagens.</strong> Modelos estão bloqueados. Só dá para responder com texto livre se ele escrever de novo (dentro de 24h).
              </p>
            </div>
          )}

          <Campo rotulo="Modelo aprovado" dica="Modelos fictícios do simulador (PROVISÓRIO, textos ainda não aprovados pelo Mateus).">
            <select className={classeEntrada} value={modelo} onChange={(e) => setModelo(e.target.value)}>
              <option value="">{livre ? "Sem modelo (texto livre)" : "Escolha um modelo"}</option>
              {MODELOS.map((m) => (
                <option key={m.codigo} value={m.codigo}>
                  {m.nome}
                </option>
              ))}
            </select>
          </Campo>
          {precisaConsentimento && (
            <Campo rotulo="Como o cliente autorizou receber mensagens da loja?" dica="A Meta exige o consentimento do cliente para mensagens que começam pela loja. Fica registrado na ficha.">
              <select className={classeEntrada} value={consentimento} onChange={(e) => setConsentimento(e.target.value)}>
                <option value="">Escolha…</option>
                {ORIGENS_CONSENTIMENTO.map((o) => (
                  <option key={o.codigo} value={o.codigo}>
                    {o.nome}
                  </option>
                ))}
              </select>
            </Campo>
          )}
          {modelo ? (
            <p className="rounded-controle bg-superficie-suave p-3 text-sm text-texto-suave">{MODELOS.find((m) => m.codigo === modelo)?.texto}</p>
          ) : (
            <Campo rotulo="Mensagem">
              <textarea
                className={juntar(classeEntrada, "min-h-28 resize-y")}
                placeholder={livre ? "Escreva a mensagem..." : "Disponível só dentro da janela de 24h"}
                disabled={!livre}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
              />
            </Campo>
          )}
          <Botao variante="primario" className="w-full sm:w-auto" icone={<Send className="size-4" aria-hidden />} carregando={enviando} disabled={!podeEnviar} onClick={enviar}>
            Enviar
          </Botao>
        </div>
      )}
    </Modal>
  );
}

function Enviado({ leadId, mensagemId, aoNova }: { leadId: string; mensagemId: string; aoNova: () => void }) {
  const { dados } = useDados<FichaLead>(`/api/leads/${leadId}`);
  const mensagem = dados?.mensagens.find((m) => m.id === mensagemId);
  return (
    <div className="space-y-4">
      <div className="rounded-card border border-borda p-4 shadow-card">
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold">{dados?.nomeExibicao ?? "..."}</p>
          {mensagem && <StatusMensagem status={mensagem.status} />}
        </div>
        <p className="mt-1 text-sm text-texto-suave">{mensagem?.texto}</p>
        {mensagem?.status === "falhou" && <p className="mt-2 text-sm text-alerta">Falhou: este número não tem WhatsApp (regra do simulador: números terminados em 0000).</p>}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/lead/${leadId}`} className="inline-flex min-h-toque items-center rounded-controle bg-marca px-4 text-sm font-medium text-sobre-marca">
          Abrir conversa
        </Link>
        <Botao onClick={aoNova}>Nova mensagem</Botao>
      </div>
    </div>
  );
}
