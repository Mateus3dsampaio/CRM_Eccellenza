"use client";

import { useEffect, useRef } from "react";

const PONTOS = 84;
const OURO = Math.PI * (3 - Math.sqrt(5));
const VELOCIDADE = 0.28; // radianos por segundo (uma volta a cada ~22 s)
const INCLINACAO = 0.32; // radianos
const IMPULSO = 5; // radianos por segundo a mais na troca de tela; some em ~0,5 s
const COR_PADRAO = "#8aaaf0";

// Pontos espalhados em espiral de Fibonacci sobre uma esfera de raio 1.
const BASE = Array.from({ length: PONTOS }, (_, i) => {
  const y = 1 - (2 * (i + 0.5)) / PONTOS;
  const r = Math.sqrt(1 - y * y);
  const a = i * OURO;
  return { x: Math.cos(a) * r, y, z: Math.sin(a) * r };
});

/**
 * Mini esfera de pontos do topo do menu lateral: irmã leve da esfera do login, em canvas 2D (sem Three.js, que só baixa no login).
 * Gira devagar; com "reduzir movimento" fica parada. A cor vem do tema (`--color-marca-texto`) e acompanha a troca de tema.
 * `parada`: desenha uma vez e não gira (estado vazio).
 * `impulso`: quando este valor muda (ex.: o caminho da tela), a esfera dá um giro rápido que se desfaz em meio segundo.
 */
export function MenuEsfera({ tamanho = 36, className, impulso, parada = false }: { tamanho?: number; className?: string; impulso?: string | number; parada?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const extra = useRef(0);
  const impulsoAnterior = useRef(impulso);

  useEffect(() => {
    if (impulsoAnterior.current === impulso) return;
    impulsoAnterior.current = impulso;
    extra.current = IMPULSO;
  }, [impulso]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = tamanho * dpr;
    canvas.height = tamanho * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const parado = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cor = COR_PADRAO;
    let angulo = 0.9; // posição inicial parada: bonita de frente
    let quadro = 0;
    let ultimo = 0;

    const lerCor = () => {
      cor = getComputedStyle(document.documentElement).getPropertyValue("--color-marca-texto").trim() || COR_PADRAO;
    };

    const desenhar = () => {
      const c = tamanho / 2;
      const raio = tamanho * 0.45;
      ctx.clearRect(0, 0, tamanho, tamanho);
      const cos = Math.cos(angulo);
      const sin = Math.sin(angulo);
      const ci = Math.cos(INCLINACAO);
      const si = Math.sin(INCLINACAO);
      const proj = BASE.map((p) => {
        const x = p.x * cos + p.z * sin;
        const z0 = -p.x * sin + p.z * cos;
        const y = p.y * ci - z0 * si;
        const z = p.y * si + z0 * ci;
        return { x, y, z };
      }).sort((a, b) => a.z - b.z); // os de trás primeiro
      ctx.fillStyle = cor;
      for (const p of proj) {
        const t = (p.z + 1) / 2; // 0 atrás, 1 na frente
        ctx.globalAlpha = 0.28 + 0.72 * t;
        ctx.beginPath();
        ctx.arc(c + p.x * raio, c + p.y * raio, 0.6 + 1.3 * t, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };

    const passo = (agora: number) => {
      quadro = requestAnimationFrame(passo);
      if (agora - ultimo < 33) return; // ~30 quadros por segundo bastam
      const dt = ultimo ? (agora - ultimo) / 1000 : 0;
      ultimo = agora;
      angulo += dt * (VELOCIDADE + extra.current);
      extra.current = extra.current < 0.01 ? 0 : extra.current * Math.exp(-dt * 6);
      desenhar();
    };

    const iniciar = () => {
      cancelAnimationFrame(quadro);
      ultimo = 0;
      if (parada || parado.matches) desenhar();
      else quadro = requestAnimationFrame(passo);
    };

    lerCor();
    iniciar();
    parado.addEventListener("change", iniciar);
    // Troca de tema: o atributo `data-tema` muda no <html>.
    const obs = new MutationObserver(() => {
      lerCor();
      if (parada || parado.matches) desenhar();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-tema"] });
    return () => {
      cancelAnimationFrame(quadro);
      parado.removeEventListener("change", iniciar);
      obs.disconnect();
    };
  }, [tamanho, parada]);

  return <canvas ref={ref} aria-hidden className={className} style={{ width: tamanho, height: tamanho }} />;
}
