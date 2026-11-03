// Som de aviso, feito no próprio navegador (sem arquivo de áudio).
// O navegador só libera som depois de um clique ou tecla do usuário: `liberarSom` prepara isso na primeira interação.

let contexto: AudioContext | null = null;

function obter(): AudioContext | null {
  try {
    contexto ??= new AudioContext();
    return contexto;
  } catch {
    return null;
  }
}

/** Chame a partir de um clique/tecla: deixa o navegador tocar sons depois, mesmo com a aba em segundo plano. */
export function liberarSom(): void {
  const ctx = obter();
  if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => undefined);
}

/** Duas notas curtas, parecidas com um "ding-dong" de mensagem. Falha em silêncio se o navegador não deixar. */
export function tocarSom(): void {
  const ctx = obter();
  if (!ctx) return;
  void ctx.resume().catch(() => undefined);
  const inicio = ctx.currentTime;
  [
    [880, 0],
    [1175, 0.16],
  ].forEach(([frequencia, atraso]) => {
    const oscilador = ctx.createOscillator();
    const volume = ctx.createGain();
    oscilador.type = "sine";
    oscilador.frequency.value = frequencia;
    volume.gain.setValueAtTime(0.0001, inicio + atraso);
    volume.gain.exponentialRampToValueAtTime(0.25, inicio + atraso + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, inicio + atraso + 0.3);
    oscilador.connect(volume).connect(ctx.destination);
    oscilador.start(inicio + atraso);
    oscilador.stop(inicio + atraso + 0.32);
  });
}
