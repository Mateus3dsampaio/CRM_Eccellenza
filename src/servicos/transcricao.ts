import OpenAI, { toFile } from "openai";
import { obterChave } from "./chaves-api";

// Transcrição de áudio (Whisper, da OpenAI). Só liga quando há chave (Configurações > Chaves de API, ou a variável OPENAI_API_KEY).
// O áudio é enviado à OpenAI para virar texto e NÃO é guardado no CRM: fica só a transcrição.
// LGPD: isso é compartilhar dado do cliente com um terceiro (fora do Brasil). Está na política de privacidade (regras/privacidade.ts).

export const LIMITE_AUDIO_BYTES = 16 * 1024 * 1024; // o WhatsApp aceita até 16 MB por áudio
const MODELO_PADRAO = "whisper-1"; // Whisper V2. Dá para trocar por OPENAI_TRANSCRICAO_MODELO (a OpenAI tem modelos de transcrição mais novos)

// Formatos que a OpenAI aceita. O WhatsApp manda recado de voz em ogg/opus; "aac" e "amr" a OpenAI não lista.
const EXTENSOES: Record<string, string> = {
  "audio/ogg": "ogg",
  "audio/opus": "ogg",
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/webm": "webm",
  "audio/flac": "flac",
};

export function tipoAudioAceito(tipo: string): boolean {
  return tipo.split(";")[0].trim().toLowerCase() in EXTENSOES;
}

export async function transcricaoConfigurada(): Promise<boolean> {
  return !!(await obterChave("audio"));
}

function clienteOpenAI(apiKey: string): OpenAI {
  // A chave nunca é exibida nem registrada. Cliente novo a cada áudio: é barato e assim uma troca de chave vale na hora.
  return new OpenAI({ apiKey, timeout: 60_000, maxRetries: 2 });
}

/** Devolve o texto falado, ou null se não deu (sem chave, formato não aceito, grande demais, erro ou áudio sem fala). Nunca lança. */
export async function transcreverAudio(dados: Buffer, tipo: string): Promise<string | null> {
  const chave = await obterChave("audio");
  if (!chave) return null;
  const extensao = EXTENSOES[tipo.split(";")[0].trim().toLowerCase()];
  if (!extensao || dados.length === 0 || dados.length > LIMITE_AUDIO_BYTES) return null;
  try {
    const resposta = await clienteOpenAI(chave).audio.transcriptions.create({
      file: await toFile(dados, `audio.${extensao}`, { type: tipo.split(";")[0].trim() }),
      model: process.env.OPENAI_TRANSCRICAO_MODELO?.trim() || MODELO_PADRAO,
      language: "pt",
    });
    const texto = resposta.text?.trim();
    return texto ? texto : null;
  } catch (erro) {
    // Só o tipo do erro vai para o log: a mensagem pode trazer pedaço do conteúdo.
    console.error("[transcricao] falhou:", erro instanceof Error ? erro.name : "erro");
    return null;
  }
}
