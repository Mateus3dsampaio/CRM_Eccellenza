"use client";

import { ArrowRightLeft, KeyRound, Pencil, Power, UserPlus, UtensilsCrossed, Users } from "lucide-react";
import { useState } from "react";
import { TEXTO_REGRA_SENHA } from "@/regras/senha";
import { chamarApi, useAviso } from "../dados";
import { juntar } from "../estilos";
import { JanelaPassarHoje } from "../equipe/passar-hoje";
import { Botao, Campo, Modal, classeEntrada } from "../ui";
import { useUsuario } from "../usuario";

export interface Membro {
  id: string;
  nome: string;
  nomeCliente: string | null;
  login: string;
  perfil: string;
  ativo: boolean;
  status: string;
  leadsEmAndamento: number;
}

type Janela =
  | { tipo: "novo" }
  | { tipo: "editar"; membro: Membro }
  | { tipo: "senha"; membro: Membro }
  | { tipo: "transferir"; membro: Membro }
  | { tipo: "desativar"; membro: Membro };

const nomePerfil = (p: string) => (p === "admin" ? "Administrador" : "Consultor");

/** Cadastro da equipe (só admin): criar, editar, redefinir senha, transferir leads, desativar, almoço. */
export function EquipeConfig({ equipe, recarregar }: { equipe: Membro[]; recarregar: () => Promise<void> }) {
  const avisar = useAviso();
  const eu = useUsuario();
  const [janela, setJanela] = useState<Janela | null>(null);
  const [passarDe, setPassarDe] = useState<string | null>(null);

  async function mudarStatus(m: Membro, status: "online" | "almoco") {
    try {
      await chamarApi("/api/equipe/status", { method: "POST", json: { usuarioId: m.id, status } });
      avisar(status === "almoco" ? `${m.nome} saiu para o almoço.` : m.status === "offline" ? `${m.nome} agora está online.` : `${m.nome} voltou.`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível mudar o status.", "erro");
    } finally {
      await recarregar();
    }
  }

  async function reativar(m: Membro) {
    try {
      await chamarApi(`/api/configuracoes/usuarios/${m.id}`, { method: "PATCH", json: { ativo: true } });
      avisar(`${m.nome} reativado.`);
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível reativar.", "erro");
    } finally {
      await recarregar();
    }
  }

  const consultoresAtivos = equipe.filter((u) => u.perfil === "consultor" && u.ativo);

  return (
    <section className="rounded-painel border border-borda bg-superficie p-5 shadow-painel">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <Users className="size-4 text-texto-suave" aria-hidden /> Equipe
        </h2>
        <Botao variante="primario" icone={<UserPlus className="size-4" aria-hidden />} onClick={() => setJanela({ tipo: "novo" })}>
          Novo usuário
        </Botao>
      </div>
      <p className="mb-3 text-sm text-texto-suave">
        <UtensilsCrossed className="mr-1 inline size-3.5" aria-hidden />
        O consultor liga o almoço no botão da tela dele e só volta a receber leads novos quando ele mesmo clicar em &quot;Voltei do almoço&quot;: nada volta sozinho, não importa quantas horas passem. Os leads que ele já tem continuam com ele.
      </p>
      <ul className="divide-y divide-borda">
        {equipe.map((u) => (
          <li key={u.id} className={juntar("space-y-2 py-3 text-sm", !u.ativo && "opacity-70")}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  {u.nome}
                  {u.id === eu.id && <span className="ml-2 text-xs font-normal text-texto-fraco">(você)</span>}
                </p>
                <p className="text-xs text-texto-fraco">
                  Login: {u.login}
                  {u.perfil === "consultor" && u.ativo && ` · ${u.leadsEmAndamento} ${u.leadsEmAndamento === 1 ? "lead em andamento" : "leads em andamento"}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-pilula bg-marca-suave px-2.5 py-1 font-medium text-marca-texto">{nomePerfil(u.perfil)}</span>
                {!u.ativo && <span className="rounded-pilula bg-superficie-suave px-2.5 py-1 text-texto-suave">Inativo</span>}
                {u.perfil === "consultor" && u.ativo && (
                  <span className={juntar("rounded-pilula px-2.5 py-1 font-medium", u.status === "almoco" ? "bg-aviso-suave text-aviso" : u.status === "offline" ? "bg-superficie-suave text-texto-suave" : "bg-sucesso-suave text-sucesso")}>
                    {u.status === "almoco" ? "Em almoço" : u.status === "offline" ? "Offline" : "Online"}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {u.ativo ? (
                <>
                  <Botao variante="fantasma" icone={<Pencil className="size-4" aria-hidden />} onClick={() => setJanela({ tipo: "editar", membro: u })}>
                    Editar
                  </Botao>
                  <Botao variante="fantasma" icone={<KeyRound className="size-4" aria-hidden />} onClick={() => setJanela({ tipo: "senha", membro: u })}>
                    Nova senha
                  </Botao>
                  {u.perfil === "consultor" && (
                    <>
                      {u.status === "offline" ? (
                        <>
                          <Botao variante="fantasma" onClick={() => mudarStatus(u, "online")}>
                            Colocar online
                          </Botao>
                          <Botao variante="fantasma" icone={<ArrowRightLeft className="size-4" aria-hidden />} onClick={() => setPassarDe(u.id)}>
                            Passar os de hoje
                          </Botao>
                        </>
                      ) : (
                        <Botao variante="fantasma" onClick={() => mudarStatus(u, u.status === "almoco" ? "online" : "almoco")}>
                          {u.status === "almoco" ? "Voltou do almoço" : "Mandar almoçar"}
                        </Botao>
                      )}
                      <Botao variante="fantasma" icone={<ArrowRightLeft className="size-4" aria-hidden />} disabled={u.leadsEmAndamento === 0} onClick={() => setJanela({ tipo: "transferir", membro: u })}>
                        Transferir leads
                      </Botao>
                    </>
                  )}
                  {u.id !== eu.id && (
                    <Botao variante="fantasma" icone={<Power className="size-4" aria-hidden />} onClick={() => setJanela({ tipo: "desativar", membro: u })}>
                      Desativar
                    </Botao>
                  )}
                </>
              ) : (
                <Botao variante="fantasma" icone={<Power className="size-4" aria-hidden />} onClick={() => reativar(u)}>
                  Reativar
                </Botao>
              )}
            </div>
          </li>
        ))}
      </ul>

      <JanelaPassarHoje deId={passarDe} aoFechar={() => setPassarDe(null)} />
      {janela?.tipo === "novo" && <JanelaNovo aoFechar={() => setJanela(null)} aoConcluir={recarregar} />}
      {janela?.tipo === "editar" && <JanelaEditar membro={janela.membro} euId={eu.id} aoFechar={() => setJanela(null)} aoConcluir={recarregar} />}
      {janela?.tipo === "senha" && <JanelaSenha membro={janela.membro} aoFechar={() => setJanela(null)} />}
      {janela?.tipo === "transferir" && <JanelaTransferir membro={janela.membro} destinos={consultoresAtivos.filter((c) => c.id !== janela.membro.id)} aoFechar={() => setJanela(null)} aoConcluir={recarregar} />}
      {janela?.tipo === "desativar" && <JanelaDesativar membro={janela.membro} destinos={consultoresAtivos.filter((c) => c.id !== janela.membro.id)} aoFechar={() => setJanela(null)} aoConcluir={recarregar} />}
    </section>
  );
}

/** Roda a chamada, mostra o resultado e fecha a janela se deu certo. */
function useEnvio(aoFechar: () => void, aoConcluir: () => Promise<void>) {
  const avisar = useAviso();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  async function enviar(chamada: () => Promise<string>) {
    setEnviando(true);
    setErro(null);
    try {
      avisar(await chamada());
      aoFechar();
      await aoConcluir();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setEnviando(false);
    }
  }
  return { enviar, enviando, erro };
}

function Erro({ texto }: { texto: string | null }) {
  return texto ? (
    <p role="alert" className="rounded-controle bg-alerta-suave px-3 py-2 text-sm text-alerta">
      {texto}
    </p>
  ) : null;
}

function Rodape({ aoFechar, enviando, rotulo, perigo }: { aoFechar: () => void; enviando: boolean; rotulo: string; perigo?: boolean }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <Botao type="button" variante="fantasma" onClick={aoFechar}>
        Cancelar
      </Botao>
      <Botao type="submit" variante={perigo ? "perigo" : "primario"} carregando={enviando}>
        {rotulo}
      </Botao>
    </div>
  );
}

function JanelaNovo({ aoFechar, aoConcluir }: { aoFechar: () => void; aoConcluir: () => Promise<void> }) {
  const [nome, setNome] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");
  const [login, setLogin] = useState("");
  const [perfil, setPerfil] = useState<"consultor" | "admin">("consultor");
  const [senha, setSenha] = useState("");
  const { enviar, enviando, erro } = useEnvio(aoFechar, aoConcluir);
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Novo usuário">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(async () => {
            await chamarApi("/api/configuracoes/usuarios", { method: "POST", json: { nome, nomeCliente, login, perfil, senha } });
            return `${nome.trim()} cadastrado.`;
          });
        }}
      >
        <Campo rotulo="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={classeEntrada} autoComplete="off" />
        </Campo>
        <Campo rotulo="Nome para o cliente" dica="Aparece em negrito no início das mensagens que esta pessoa envia no WhatsApp. Vazio = primeiro nome do cadastro.">
          <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} className={classeEntrada} maxLength={40} placeholder="Ex.: Ana" autoComplete="off" />
        </Campo>
        <Campo rotulo="Login" dica="Letras minúsculas, números, ponto, traço ou sublinhado. É com ele que a pessoa entra.">
          <input value={login} onChange={(e) => setLogin(e.target.value)} className={classeEntrada} autoComplete="off" autoCapitalize="none" />
        </Campo>
        <Campo rotulo="Perfil">
          <select value={perfil} onChange={(e) => setPerfil(e.target.value as "consultor" | "admin")} className={classeEntrada}>
            <option value="consultor">Consultor (vendedor)</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
        <Campo rotulo="Senha inicial" dica={TEXTO_REGRA_SENHA}>
          <input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} className={classeEntrada} autoComplete="off" />
        </Campo>
        <Erro texto={erro} />
        <Rodape aoFechar={aoFechar} enviando={enviando} rotulo="Cadastrar" />
      </form>
    </Modal>
  );
}

function JanelaEditar({ membro, euId, aoFechar, aoConcluir }: { membro: Membro; euId: string; aoFechar: () => void; aoConcluir: () => Promise<void> }) {
  const [nome, setNome] = useState(membro.nome);
  const [nomeCliente, setNomeCliente] = useState(membro.nomeCliente ?? "");
  const [perfil, setPerfil] = useState(membro.perfil);
  const { enviar, enviando, erro } = useEnvio(aoFechar, aoConcluir);
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Editar ${membro.nome}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(async () => {
            await chamarApi(`/api/configuracoes/usuarios/${membro.id}`, { method: "PATCH", json: { nome, nomeCliente, perfil } });
            return "Dados salvos.";
          });
        }}
      >
        <Campo rotulo="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={classeEntrada} />
        </Campo>
        <Campo rotulo="Nome para o cliente" dica="Aparece em negrito no início das mensagens que esta pessoa envia no WhatsApp. Vazio = primeiro nome do cadastro.">
          <input value={nomeCliente} onChange={(e) => setNomeCliente(e.target.value)} className={classeEntrada} maxLength={40} placeholder="Ex.: Ana" autoComplete="off" />
        </Campo>
        <Campo rotulo="Perfil" dica={membro.id === euId ? "Você não pode mudar o seu próprio perfil." : "Administrador vê tudo e mexe nas configurações. Consultor só atende."}>
          <select value={perfil} onChange={(e) => setPerfil(e.target.value)} disabled={membro.id === euId} className={classeEntrada}>
            <option value="consultor">Consultor (vendedor)</option>
            <option value="admin">Administrador</option>
          </select>
        </Campo>
        <Erro texto={erro} />
        <Rodape aoFechar={aoFechar} enviando={enviando} rotulo="Salvar" />
      </form>
    </Modal>
  );
}

function JanelaSenha({ membro, aoFechar }: { membro: Membro; aoFechar: () => void }) {
  const [senha, setSenha] = useState("");
  const { enviar, enviando, erro } = useEnvio(aoFechar, async () => undefined);
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Nova senha para ${membro.nome}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(async () => {
            await chamarApi(`/api/configuracoes/usuarios/${membro.id}`, { method: "PATCH", json: { senha } });
            return `Senha de ${membro.nome} trocada. Passe a nova senha para a pessoa.`;
          });
        }}
      >
        <Campo rotulo="Senha nova" dica={TEXTO_REGRA_SENHA}>
          <input type="text" value={senha} onChange={(e) => setSenha(e.target.value)} className={classeEntrada} autoComplete="off" />
        </Campo>
        <p className="text-xs text-texto-fraco">Quem já está com o sistema aberto continua entrando até a sessão acabar (12 horas). Para cortar o acesso na hora, use &quot;Desativar&quot;.</p>
        <Erro texto={erro} />
        <Rodape aoFechar={aoFechar} enviando={enviando} rotulo="Trocar senha" />
      </form>
    </Modal>
  );
}

function SeletorDestino({ destinos, valor, aoMudar }: { destinos: Membro[]; valor: string; aoMudar: (v: string) => void }) {
  return (
    <Campo rotulo="Passar os leads para">
      <select value={valor} onChange={(e) => aoMudar(e.target.value)} className={classeEntrada}>
        <option value="">Escolha um consultor</option>
        {destinos.map((d) => (
          <option key={d.id} value={d.id}>
            {d.nome}
            {d.status === "almoco" ? " (em almoço)" : ""}
          </option>
        ))}
      </select>
    </Campo>
  );
}

function JanelaTransferir({ membro, destinos, aoFechar, aoConcluir }: { membro: Membro; destinos: Membro[]; aoFechar: () => void; aoConcluir: () => Promise<void> }) {
  const [para, setPara] = useState("");
  const { enviar, enviando, erro } = useEnvio(aoFechar, aoConcluir);
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Transferir leads de ${membro.nome}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(async () => {
            const r = await chamarApi<{ transferidos: number }>("/api/configuracoes/usuarios/transferir", { method: "POST", json: { de: membro.id, para } });
            return `${r.transferidos} ${r.transferidos === 1 ? "lead transferido" : "leads transferidos"}.`;
          });
        }}
      >
        <p className="text-sm text-texto-suave">
          Vão {membro.leadsEmAndamento} {membro.leadsEmAndamento === 1 ? "lead em andamento" : "leads em andamento"} (não conta arquivados, fechados nem perdidos). A conversa e o histórico vão junto.
        </p>
        {destinos.length ? <SeletorDestino destinos={destinos} valor={para} aoMudar={setPara} /> : <p className="text-sm text-aviso">Não há outro consultor ativo. Cadastre um primeiro.</p>}
        <Erro texto={erro} />
        <Rodape aoFechar={aoFechar} enviando={enviando || !para} rotulo="Transferir" />
      </form>
    </Modal>
  );
}

function JanelaDesativar({ membro, destinos, aoFechar, aoConcluir }: { membro: Membro; destinos: Membro[]; aoFechar: () => void; aoConcluir: () => Promise<void> }) {
  const [para, setPara] = useState("");
  const temLeads = membro.perfil === "consultor" && membro.leadsEmAndamento > 0;
  const { enviar, enviando, erro } = useEnvio(aoFechar, aoConcluir);
  const semDestino = temLeads && destinos.length === 0;
  return (
    <Modal aberto aoFechar={aoFechar} titulo={`Desativar ${membro.nome}`}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(async () => {
            const r = await chamarApi<{ transferidos: number }>(`/api/configuracoes/usuarios/${membro.id}`, { method: "PATCH", json: { ativo: false, transferirPara: temLeads ? para : undefined } });
            return r.transferidos ? `${membro.nome} desativado. ${r.transferidos} ${r.transferidos === 1 ? "lead foi" : "leads foram"} transferidos.` : `${membro.nome} desativado.`;
          });
        }}
      >
        <p className="text-sm text-texto-suave">A pessoa não consegue mais entrar. O histórico, as conversas e as visitas dela continuam no sistema. Você pode reativar depois.</p>
        {temLeads &&
          (semDestino ? (
            <p className="text-sm text-aviso">{membro.nome} tem {membro.leadsEmAndamento} leads em andamento e não há outro consultor ativo para recebê-los. Cadastre um consultor primeiro.</p>
          ) : (
            <>
              <p className="text-sm text-aviso">
                {membro.nome} tem {membro.leadsEmAndamento} {membro.leadsEmAndamento === 1 ? "lead em andamento" : "leads em andamento"}. Eles precisam ir para outro consultor.
              </p>
              <SeletorDestino destinos={destinos} valor={para} aoMudar={setPara} />
            </>
          ))}
        <Erro texto={erro} />
        <Rodape aoFechar={aoFechar} enviando={enviando || semDestino || (temLeads && !para)} rotulo="Desativar" perigo />
      </form>
    </Modal>
  );
}

/** Janela de "Trocar minha senha", aberta pelo cabeçalho (qualquer usuário). */
export function JanelaMinhaSenha({ aoFechar }: { aoFechar: () => void }) {
  const [atual, setAtual] = useState("");
  const [nova, setNova] = useState("");
  const { enviar, enviando, erro } = useEnvio(aoFechar, async () => undefined);
  return (
    <Modal aberto aoFechar={aoFechar} titulo="Trocar minha senha">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void enviar(async () => {
            await chamarApi("/api/conta/senha", { method: "POST", json: { senhaAtual: atual, senhaNova: nova } });
            return "Senha trocada.";
          });
        }}
      >
        <Campo rotulo="Senha atual">
          <input type="password" value={atual} onChange={(e) => setAtual(e.target.value)} className={classeEntrada} autoComplete="current-password" />
        </Campo>
        <Campo rotulo="Senha nova" dica={TEXTO_REGRA_SENHA}>
          <input type="password" value={nova} onChange={(e) => setNova(e.target.value)} className={classeEntrada} autoComplete="new-password" />
        </Campo>
        <Erro texto={erro} />
        <Rodape aoFechar={aoFechar} enviando={enviando} rotulo="Trocar senha" />
      </form>
    </Modal>
  );
}
