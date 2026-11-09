/**
 * Esfera de pontos "Eccellenza" do login (Three.js, sem React). Veio do protótipo aprovado pelo Mateus em 09/11/2026.
 *
 * Como funciona: cada pontinho tem três lugares guardados (nuvem solta, letra do nome, ponto da esfera) e o shader
 * (`esfera-shader.ts`) mistura entre eles. A animação dos pontos roda na placa de vídeo; aqui só se movem alguns
 * números (onda, mouse, toques, física do corpo), por isso aguenta milhares de pontos no celular.
 *
 * Linha do tempo: nuvem → os pontos formam "Eccellenza" → o nome vira a esfera → a cada ~8 s uma onda sobe e acende o nome.
 * Mouse: a superfície estufa e brilha. Clique/toque: ondas de gel (cliques seguidos somam força).
 * Segurar e arrastar: estica como tecido; soltar arremessa com a velocidade do mouse e ela volta devagar ao lugar.
 * Colisão mole: bate nas bordas da tela e no cartão do login (com o canto arredondado), amassa copiando a forma,
 * estufa para os lados, quica e treme no ponto da batida.
 * Cores: as do tema escolhido no CRM neste aparelho (`data-tema` já aplicado pelo `layout.tsx`).
 *
 * `iniciarEsfera` lança erro se o navegador não tiver 3D (WebGL); a tela mostra o nome parado no lugar.
 */
import * as THREE from "three";
import { TEMAS } from "@/regras/temas";
import { lerTema } from "@/componentes/tema";
import { SHADER_FRAGMENTO, SHADER_VERTICE } from "./esfera-shader";

export interface PalcoEsfera {
  /** Onde o canvas é posto (a página toda, atrás do cartão). Recebe as variáveis --cx/--cy do brilho de fundo. */
  fundo: HTMLElement;
  /** Espaço reservado para a esfera: ela fica centrada aqui e volta para cá. */
  lugar: HTMLElement;
  /** Cartão do login: a esfera colide nele. */
  cartao: HTMLElement;
  /** Brilho que pulsa quando o nome se forma. */
  halo: HTMLElement;
}

const NOME = "Eccellenza";
const MASC_L = 1024;
const MASC_A = 230;
const OURO = Math.PI * (3 - Math.sqrt(5));

// Física do contato (ajustada com o Mateus no protótipo)
const MOLA_PAREDE = 300; // força da mola do contato (menos = mais mole; quica em ~0,18 s)
const MOLA_SEGURANDO = 110; // segurando e empurrando com o mouse, o contato cede mais (dá para afundar o canto)
const AMORT_PAREDE = 7; // quanto o contato segura a velocidade (perde energia ao quicar)
const AMASSA_MAX = 0.45; // quanto a esfera pode amassar no máximo (fração do raio)

const hexRgb = (h: string) => {
  const n = parseInt(h.replace("#", "").slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgbHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const misturar = (a: string, b: string, t: number) => {
  const A = hexRgb(a), B = hexRgb(b);
  return rgbHex(A.map((v, i) => v + (B[i] - v) * t));
};

export function iniciarEsfera(palco: PalcoEsfera): () => void {
  const { fundo, lugar, cartao, halo: elHalo } = palco;
  const pequeno = matchMedia("(max-width: 959px)").matches;
  const QTD = pequeno ? 7000 : 9000;
  let vivo = true;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const dormir = (ms: number) =>
    new Promise<void>((pronto) => {
      const t = setTimeout(() => { timers.delete(t); pronto(); }, ms);
      timers.add(t);
    });

  /* ---------- 1. Cena (lança erro se não houver WebGL) ---------- */
  const canvas = document.createElement("canvas");
  // confere antes: sem isso o Three.js escreve erro no console antes de desistir
  if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) throw new Error("Navegador sem WebGL");
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100dvh;display:block;touch-action:none;z-index:0";
  const renderizador = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
  renderizador.setPixelRatio(Math.min(devicePixelRatio, 2));
  fundo.prepend(canvas);
  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 10);

  /* ---------- 2. Máscara do nome: onde os pontos formam o nome e quais acendem na esfera ---------- */
  const mascaraCanvas = document.createElement("canvas");
  mascaraCanvas.width = MASC_L;
  mascaraCanvas.height = MASC_A;
  const mascaraTex = new THREE.CanvasTexture(mascaraCanvas);
  mascaraTex.minFilter = THREE.LinearFilter;
  const fonte = getComputedStyle(document.body).fontFamily || "Inter, sans-serif";

  function desenharMascara(): number[] {
    const ctx = mascaraCanvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, MASC_L, MASC_A);
    let tam = 200;
    ctx.font = `800 ${tam}px ${fonte}`;
    tam *= (MASC_L * 0.94) / ctx.measureText(NOME).width;
    ctx.font = `800 ${tam}px ${fonte}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText(NOME, MASC_L / 2, MASC_A / 2 + tam * 0.04);
    mascaraTex.needsUpdate = true;
    const dados = ctx.getImageData(0, 0, MASC_L, MASC_A).data;
    const acesos: number[] = [];
    for (let y = 0; y < MASC_A; y += 2) for (let x = 0; x < MASC_L; x += 2) if (dados[(y * MASC_L + x) * 4] > 140) acesos.push(x, y);
    return acesos;
  }

  /* ---------- 3. Pontos ---------- */
  const geo = new THREE.BufferGeometry();
  const aEsfera = new Float32Array(QTD * 3);
  const aTexto = new Float32Array(QTD * 3);
  const aNuvem = new Float32Array(QTD * 3);
  const aAleat = new Float32Array(QTD);
  for (let i = 0; i < QTD; i++) {
    // esfera de Fibonacci: pontos bem distribuídos, sem amontoar nos polos
    const y = 1 - (2 * (i + 0.5)) / QTD, r = Math.sqrt(1 - y * y), th = i * OURO;
    aEsfera.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
    const v = new THREE.Vector3().randomDirection().multiplyScalar(0.6 + Math.random() * 1.6);
    aNuvem.set([v.x * 1.6, v.y, v.z], i * 3);
    aAleat[i] = Math.random();
  }
  geo.setAttribute("position", new THREE.BufferAttribute(aEsfera, 3)); // o three exige "position"; o shader usa os outros
  geo.setAttribute("aEsfera", new THREE.BufferAttribute(aEsfera, 3));
  geo.setAttribute("aTexto", new THREE.BufferAttribute(aTexto, 3));
  geo.setAttribute("aNuvem", new THREE.BufferAttribute(aNuvem, 3));
  geo.setAttribute("aAleat", new THREE.BufferAttribute(aAleat, 1));

  function sortearTexto(acesos: number[]) {
    const n = acesos.length / 2;
    if (!n) return;
    for (let i = 0; i < QTD; i++) {
      const k = Math.floor(Math.random() * n);
      const x = (acesos[k * 2] + Math.random() * 2) / MASC_L - 0.5;
      const y = -(acesos[k * 2 + 1] + Math.random() * 2 - MASC_A / 2) / MASC_L;
      aTexto.set([x, y, Math.random() * 2 - 1], i * 3);
    }
    geo.attributes.aTexto.needsUpdate = true;
  }

  const u = {
    uTempo: { value: 0 },
    uRaio: { value: 1 },
    uTextoLarg: { value: 3 },
    uNomeLarg: { value: 1.82 },
    uMascAspecto: { value: MASC_L / MASC_A },
    uMascara: { value: mascaraTex },
    uPixel: { value: 2 },
    uA: { value: 0 }, // nuvem → nome
    uB: { value: 0 }, // nome → esfera
    uRot: { value: new THREE.Matrix3() },
    uMouse: { value: new THREE.Vector3(0, 0, 99) },
    uHover: { value: 0 },
    uOnda: { value: -2 }, // altura da frente da onda (-1 embaixo, 1 em cima)
    uOndaForca: { value: 0 },
    uOndaNome: { value: 0 }, // quanto o nome aceso pela onda ainda brilha
    uRevelaCentro: { value: new THREE.Vector3(0, 0, 1) },
    uRevela: { value: 0 }, // raio do nome aceso pelo toque
    uRevelaNome: { value: 0 },
    uGel: { value: 0 },
    uGelEixo: { value: new THREE.Vector3(0, 0, 1) },
    uGel2: { value: 0 },
    uGelEixo2: { value: new THREE.Vector3(1, 0, 0) },
    uToques: { value: [0, 1, 2, 3].map(() => new THREE.Vector4(0, 0, 1, -99)) },
    uToquesForca: { value: [1, 1, 1, 1] },
    uCentro: { value: new THREE.Vector3() }, // onde a esfera está (arrastada ou voltando)
    uPuxao: { value: new THREE.Vector3() }, // quanto o ponto agarrado está esticado
    uAgarre: { value: new THREE.Vector3(0, 0, 1) }, // ponto agarrado, em relação ao centro
    uVel: { value: new THREE.Vector3() },
    uTela: { value: new THREE.Vector2(1, 1) }, // tamanho da tela em pixels
    uCartao: { value: new THREE.Vector4(-9, -9, -9, -9) }, // cartão em pixels: esquerda, topo, direita, base
    uRaioCartao: { value: 16 }, // raio do canto arredondado do cartão (lido do CSS)
    uContato: { value: 0 }, // 0 na abertura (nome), 1 quando já é esfera
    uCentroPx: { value: new THREE.Vector2(-9999, -9999) }, // centro da esfera em pixels
    uAperto: { value: new THREE.Vector4(0, -1, 0, 0) }, // xyz: lado prensado; w: quanto está prensada
    uCorBaixo: { value: new THREE.Color() },
    uCorCima: { value: new THREE.Color() },
    uCorBrilho: { value: new THREE.Color() },
    uCorNome: { value: new THREE.Color() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: u,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: SHADER_VERTICE,
    fragmentShader: SHADER_FRAGMENTO,
  });
  const pontos = new THREE.Points(geo, material);
  pontos.frustumCulled = false;
  cena.add(pontos);

  /* ---------- 4. Cores do tema do CRM ---------- */
  {
    const tema = TEMAS.find((t) => t.codigo === lerTema()) ?? TEMAS[0];
    const c = tema.cores;
    const css = getComputedStyle(document.documentElement);
    const marca = css.getPropertyValue("--color-marca").trim() || c[5];
    const marcaTexto = css.getPropertyValue("--color-marca-texto").trim() || c[3];
    const hex = (cor: string, reserva: string) => (/^#[0-9a-f]{6}$/i.test(cor) ? cor : reserva);
    u.uCorBaixo.value.set(hex(marca, c[5])); // base na cor da marca
    u.uCorCima.value.set(misturar(c[3], c[4], 0.35)); // topo nos tons claros do tema
    u.uCorBrilho.value.set(misturar(hex(marcaTexto, c[3]), "#ffffff", 0.3));
    u.uCorNome.value.set(misturar(c[4], "#ffffff", 0.4));
  }

  /* ---------- 5. Lugar na tela ---------- */
  let mundoPorPx = 0.01;
  function ajustarTamanho() {
    const W = innerWidth, H = innerHeight;
    renderizador.setSize(W, H, false);
    camera.aspect = W / H;
    const r = lugar.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    camera.setViewOffset(W, H, W / 2 - cx, H / 2 - cy, W, H);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    mundoPorPx = (2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / H;
    const raioPx = Math.min(r.width, r.height) * 0.32;
    u.uRaio.value = raioPx * mundoPorPx;
    // nome formado: até 3,4× o raio, sem passar de 88% da largura da tela
    u.uTextoLarg.value = Math.min(raioPx * 3.4, W * 0.88) * mundoPorPx;
    u.uPixel.value = Math.max(1.5, raioPx * 0.016) * renderizador.getPixelRatio();
    fundo.style.setProperty("--cx", cx + "px");
    fundo.style.setProperty("--cy", cy + "px");
    elHalo.style.setProperty("--tam-halo", Math.round(raioPx * 4.4) + "px");
  }

  /* ---------- 6. Animações simples (um número indo de A a B) ---------- */
  type Valor = { value: number };
  const animacoes: { t: number; dur: number; passo: (f: number) => void; fim: () => void }[] = [];
  function animar(alvo: Valor, ate: number, dur: number, curva: (t: number) => number = (t) => t) {
    return new Promise<void>((pronto) => {
      const de = alvo.value;
      animacoes.push({ t: 0, dur, passo: (f) => { alvo.value = de + (ate - de) * curva(f); }, fim: () => { alvo.value = ate; pronto(); } });
    });
  }
  const entraSai = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function pulsarHalo() {
    elHalo.classList.remove("ativo");
    void elHalo.offsetWidth;
    elHalo.classList.add("ativo");
  }

  let ondaRodando = false;
  async function passarOnda() {
    if (ondaRodando || u.uB.value < 1 || !vivo) return;
    ondaRodando = true;
    u.uOnda.value = -1.35;
    u.uOndaNome.value = 1;
    animar(u.uOndaForca, 1, 0.5);
    await animar(u.uOnda, 1.35, 3.2);
    animar(u.uOndaForca, 0, 0.4);
    await dormir(900);
    await animar(u.uOndaNome, 0, 1.4, entraSai);
    ondaRodando = false;
  }

  /* ---------- 7. Abertura e ciclo ---------- */
  async function abertura() {
    await animar(u.uA, 1, 2.4, entraSai); // nuvem → nome
    pulsarHalo();
    await dormir(1700);
    await animar(u.uB, 1, 2.2, entraSai); // nome → esfera
    await dormir(400);
    passarOnda();
    while (vivo) {
      await dormir(8000);
      passarOnda();
    }
  }

  /* ---------- 8. Mouse, toque e arrastar ---------- */
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  const esferaDeToque = new THREE.Sphere(new THREE.Vector3(), 1);
  const planoZ0 = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const acerto = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  let hoverAlvo = 0;

  // Física do corpo: centro (C) com velocidade (V) e o puxão (P) do ponto agarrado, que é uma mola própria
  const C = u.uCentro.value, V = new THREE.Vector3();
  const P = u.uPuxao.value, VP = new THREE.Vector3();
  const cursorMundo = new THREE.Vector3();
  const velCursor = new THREE.Vector3(), cursorAnt = new THREE.Vector3();
  let tCursorAnt = 0;

  function mirar(e: PointerEvent) {
    ponteiro.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
  }
  function acertar(e: PointerEvent) {
    mirar(e);
    esferaDeToque.center.copy(C);
    esferaDeToque.radius = u.uRaio.value * 1.08;
    return u.uB.value > 0.9 && raio.ray.intersectSphere(esferaDeToque, acerto) ? acerto.clone() : null;
  }
  function cursorNoPlano(e: PointerEvent) {
    mirar(e);
    raio.ray.intersectPlane(planoZ0, cursorMundo);
  }

  const q = new THREE.Quaternion();
  let pressao: { x: number; y: number; t: number; p: THREE.Vector3 } | null = null;
  let arrastando = false, proximoToque = 0, ultimoClique = 0, combo = 0;

  function aoApertar(e: PointerEvent) {
    const p = acertar(e);
    if (!p) return;
    pressao = { x: e.clientX, y: e.clientY, t: performance.now(), p };
    canvas.setPointerCapture(e.pointerId);
  }
  function aoMover(e: PointerEvent) {
    if (!pressao) {
      const p = acertar(e);
      if (p) { u.uMouse.value.copy(p); hoverAlvo = 1; } else hoverAlvo = 0;
      canvas.style.cursor = p ? "grab" : "default";
      return;
    }
    if (!arrastando && Math.hypot(e.clientX - pressao.x, e.clientY - pressao.y) > 6) {
      arrastando = true;
      hoverAlvo = 0;
      canvas.style.cursor = "grabbing";
      // onde agarrou, em relação ao centro
      u.uAgarre.value.copy(pressao.p).sub(C);
      u.uAgarre.value.z = Math.max(u.uAgarre.value.z, 0);
      cursorNoPlano(e);
      cursorAnt.copy(cursorMundo);
      tCursorAnt = performance.now();
      velCursor.set(0, 0, 0);
    }
    if (arrastando) {
      cursorNoPlano(e);
      // velocidade do dedo (suavizada), usada como inércia ao soltar
      const agora = performance.now(), dtc = (agora - tCursorAnt) / 1000;
      if (tCursorAnt && dtc > 0.004) velCursor.lerp(tmp2.copy(cursorMundo).sub(cursorAnt).divideScalar(dtc), 0.45);
      cursorAnt.copy(cursorMundo);
      tCursorAnt = agora;
    }
  }
  function aoSoltar(e: PointerEvent) {
    if (!pressao) return;
    const agora = performance.now();
    if (arrastando) {
      arrastando = false;
      canvas.style.cursor = "grab";
      // inércia: segue com a velocidade do dedo, um pouco aumentada (se o dedo já tinha parado, não segue)
      if (agora - tCursorAnt > 90) velCursor.set(0, 0, 0);
      V.copy(velCursor).multiplyScalar(1.35).clampLength(0, u.uRaio.value * 20);
    } else if (agora - pressao.t < 400) {
      combo = agora - ultimoClique < 450 ? combo + 1 : 1;
      ultimoClique = agora;
      tocar(pressao.p, e, Math.min(1 + 0.7 * (combo - 1), 3.2));
    }
    pressao = null;
  }
  function aoSair() {
    if (!pressao) hoverAlvo = 0;
  }
  canvas.addEventListener("pointerdown", aoApertar);
  canvas.addEventListener("pointermove", aoMover);
  canvas.addEventListener("pointerup", aoSoltar);
  canvas.addEventListener("pointercancel", aoSoltar);
  canvas.addEventListener("pointerleave", aoSair);

  let velGel = 0, velGel2 = 0;
  // Ondas de gel e balanço de gelatina a partir da direção n (vale para clique e para batida)
  function ondular(n: THREE.Vector3, forca: number) {
    u.uToques.value[proximoToque].set(n.x, n.y, n.z, u.uTempo.value);
    u.uToquesForca.value[proximoToque] = forca;
    proximoToque = (proximoToque + 1) % 4;
    u.uGelEixo.value.copy(n);
    const lado = new THREE.Vector3(0, 1, 0).cross(n);
    u.uGelEixo2.value.copy(lado.lengthSq() > 0.01 ? lado.normalize() : new THREE.Vector3(1, 0, 0));
    velGel -= 6 * forca;
    velGel2 += 4 * forca * (Math.random() < 0.5 ? -1 : 1);
  }
  function tocar(ponto: THREE.Vector3, e: PointerEvent, forca: number) {
    const n = ponto.clone().sub(C).normalize();
    ondular(n, forca);
    // o golpe empurra a esfera um pouco para longe de onde bateu
    V.addScaledVector(new THREE.Vector3(-n.x, -n.y, 0), u.uRaio.value * 0.9 * forca);
    // o nome acende a partir do ponto tocado
    u.uRevelaCentro.value.copy(n);
    u.uRevela.value = 0;
    u.uRevelaNome.value = 1;
    animar(u.uRevela, 2.4, 1.3, (t) => 1 - Math.pow(1 - t, 2))
      .then(() => dormir(800))
      .then(() => animar(u.uRevelaNome, 0, 1.2, entraSai));
    const onda = document.createElement("div");
    onda.className = "login-onda";
    onda.style.left = e.clientX + "px";
    onda.style.top = e.clientY + "px";
    onda.style.borderWidth = 2 + forca + "px";
    document.body.append(onda);
    setTimeout(() => onda.remove(), 700);
  }

  /* ---------- 8b. Colisão mole com as bordas da tela e o cartão ----------
   * Corpo (aqui): o centro pode entrar um pouco no obstáculo; uma mola forte empurra de volta (amassa e quica).
   *   A conta é em pixels, projetando pontos da superfície pela câmera (perto das bordas a esfera parece maior).
   * Forma (no shader): ponto nenhum passa da face; numa face reta a esfera fica reta e o canto afunda nela. */
  let ultimaBatida = 0;
  let contatos = new Set<string>(), contatosAntes = new Set<string>();
  const apertoAlvo = new THREE.Vector4(0, -1, 0, 0);
  const dirBatida = new THREE.Vector3();
  const DIRS = Array.from({ length: 48 }, (_, i) => {
    const y = 1 - (2 * (i + 0.5)) / 48, r = Math.sqrt(1 - y * y), th = i * OURO;
    return new THREE.Vector3(Math.cos(th) * r, y, Math.sin(th) * r);
  });
  const pj = new THREE.Vector3();
  const ptoTmp = new THREE.Vector3();

  function paraPixel(v: THREE.Vector3) {
    pj.copy(v).project(camera);
    pj.set((pj.x + 1) * 0.5 * innerWidth, (1 - pj.y) * 0.5 * innerHeight, 0);
    return pj;
  }
  function caixaDaEsfera() {
    const R = u.uRaio.value;
    let esq = Infinity, dir = -Infinity, cima = Infinity, baixo = -Infinity;
    for (const d of DIRS) {
      paraPixel(ptoTmp.copy(d).multiplyScalar(R).add(C));
      esq = Math.min(esq, pj.x); dir = Math.max(dir, pj.x); cima = Math.min(cima, pj.y); baixo = Math.max(baixo, pj.y);
    }
    return { esq, dir, cima, baixo };
  }
  // Batida: treme a partir do ponto que encostou (dx, dy aponta do centro para o obstáculo, no mundo)
  function bater(dx: number, dy: number, velocidade: number) {
    const R = u.uRaio.value, agora = performance.now();
    const forca = Math.min(velocidade / (R * 3), 2.2);
    if (forca < 0.12 || agora - ultimaBatida < 120) return;
    ultimaBatida = agora;
    ondular(dirBatida.set(dx, dy, 0).normalize(), forca * 0.8);
  }
  // entra = quantos pixels passou do obstáculo; (nx, ny) = normal no mundo, apontando para fora
  function empurrar(nome: string, entra: number, nx: number, ny: number, raioPx: number, dt: number) {
    contatos.add(nome);
    if (entra / raioPx > apertoAlvo.w) apertoAlvo.set(-nx, -ny, 0, Math.min(entra / raioPx, AMASSA_MAX));
    const k = mundoPorPx, vn = V.x * nx + V.y * ny;
    if (!contatosAntes.has(nome) && vn < 0) bater(-nx, -ny, -vn); // treme só ao encostar, não enquanto prensada
    const a = (arrastando ? MOLA_SEGURANDO : MOLA_PAREDE) * entra * k - AMORT_PAREDE * vn;
    V.x += nx * a * dt;
    V.y += ny * a * dt;
    const max = AMASSA_MAX * raioPx;
    if (entra > max) {
      C.x += nx * (entra - max) * k;
      C.y += ny * (entra - max) * k;
      const v2 = V.x * nx + V.y * ny;
      if (v2 < 0) { V.x -= v2 * nx; V.y -= v2 * ny; }
    }
  }
  let caixaCartao = cartao.getBoundingClientRect();
  const raioCartao = parseFloat(getComputedStyle(cartao).borderTopLeftRadius) || 0;
  u.uRaioCartao.value = raioCartao;

  function colidir(dt: number) {
    if (u.uB.value < 0.9) return; // só depois que virou esfera
    [contatosAntes, contatos] = [contatos, contatosAntes];
    contatos.clear();
    const b = caixaDaEsfera();
    const r = Math.max(b.dir - b.esq, b.baixo - b.cima) / 2;
    // bordas da tela (y da tela é invertido em relação ao mundo)
    if (b.esq < 0) empurrar("esq", -b.esq, 1, 0, r, dt);
    if (b.dir > innerWidth) empurrar("dir", b.dir - innerWidth, -1, 0, r, dt);
    if (b.cima < 0) empurrar("cima", -b.cima, 0, -1, r, dt);
    if (b.baixo > innerHeight) empurrar("baixo", b.baixo - innerHeight, 0, 1, r, dt);
    // cartão: círculo contra retângulo de canto arredondado (retângulo encolhido pelo raio do canto)
    const cx = (b.esq + b.dir) / 2, cy = (b.cima + b.baixo) / 2;
    const c = caixaCartao, rc = raioCartao;
    const qx = Math.min(Math.max(cx, c.left + rc), c.right - rc), qy = Math.min(Math.max(cy, c.top + rc), c.bottom - rc);
    const dx = cx - qx, dy = cy - qy, d = Math.hypot(dx, dy);
    if (d - rc >= r) return;
    let nx: number, ny: number, entra: number;
    if (d > rc) { nx = dx / d; ny = dy / d; entra = r - (d - rc); }
    else {
      // centro caiu dentro do cartão (movimento muito rápido): sai pelo lado mais perto
      const lados: [number, number, number][] = [[cx - c.left, -1, 0], [c.right - cx, 1, 0], [cy - c.top, 0, -1], [c.bottom - cy, 0, 1]];
      lados.sort((a, z) => a[0] - z[0]);
      [, nx, ny] = lados[0];
      entra = lados[0][0] + r;
    }
    empurrar("cartao", entra, nx, -ny, r, dt); // normal de pixel → mundo
  }
  // cartão e tela vão para o shader a cada quadro (o cartão entra animado e muda de altura com aviso de erro)
  function atualizarObstaculos() {
    caixaCartao = cartao.getBoundingClientRect();
    u.uCartao.value.set(caixaCartao.left, caixaCartao.top, caixaCartao.right, caixaCartao.bottom);
    u.uTela.value.set(innerWidth, innerHeight);
    u.uContato.value = Math.min(Math.max((u.uB.value - 0.8) / 0.2, 0), 1);
  }

  /* ---------- 9. Quadro a quadro ---------- */
  const relogio = new THREE.Clock();
  const giroAuto = new THREE.Quaternion();
  const eixoY = new THREE.Vector3(0, 1, 0);
  const mat4 = new THREE.Matrix4();
  let quadroId = 0;

  function quadro() {
    if (!vivo) return;
    const dt = Math.min(relogio.getDelta(), 1 / 20);
    u.uTempo.value = relogio.elapsedTime;

    for (let i = animacoes.length - 1; i >= 0; i--) {
      const a = animacoes[i];
      a.t += dt / a.dur;
      if (a.t >= 1) { animacoes.splice(i, 1); a.fim(); } else a.passo(a.t);
    }

    // giro lento sozinho
    q.premultiply(giroAuto.setFromAxisAngle(eixoY, dt * 0.14));
    u.uRot.value.setFromMatrix4(mat4.makeRotationFromQuaternion(q));

    // Corpo: arrastando, o centro persegue o dedo com atraso (por isso estica); solto, mola fraca de volta ao lugar.
    // Em passos pequenos (até 1/120 s) para a mola do contato não ficar instável.
    const R = u.uRaio.value;
    atualizarObstaculos();
    const passos = Math.max(1, Math.ceil(dt * 120)), h = dt / passos;
    apertoAlvo.w = 0;
    for (let i = 0; i < passos; i++) {
      if (arrastando) {
        tmp.copy(cursorMundo).sub(u.uAgarre.value);
        tmp.z = 0; // onde o centro "quer" estar (sempre no plano da tela)
        V.addScaledVector(tmp.sub(C), 22 * h).multiplyScalar(Math.exp(-6 * h));
      } else {
        // puxão volta como geleia
        VP.addScaledVector(P, -55 * h).multiplyScalar(Math.exp(-3 * h));
        P.addScaledVector(VP, h);
        // inércia com pouco atrito + volta lenta ao centro
        V.addScaledVector(C, -0.4 * h).multiplyScalar(Math.exp(-0.6 * h));
      }
      colidir(h);
      C.addScaledVector(V, h);
    }
    if (arrastando) {
      // o ponto agarrado fica exatamente no dedo: o puxão é a diferença (o shader amassa o que encostar)
      P.copy(cursorMundo).sub(C).sub(u.uAgarre.value);
      P.z = 0;
      P.clampLength(0, R * 1.6);
      VP.set(0, 0, 0);
    }
    u.uVel.value.copy(V);
    paraPixel(C);
    u.uCentroPx.value.set(pj.x, pj.y);
    // aperto vai ao shader suavizado (achata e estufa sem pular)
    const ap = u.uAperto.value;
    if (apertoAlvo.w > 0.001) { ap.x = apertoAlvo.x; ap.y = apertoAlvo.y; ap.z = 0; }
    ap.w += (apertoAlvo.w - ap.w) * (1 - Math.exp(-25 * dt));

    // mouse e gelatina (molas moles e pouco amortecidas: balança devagar por uns 2–3 segundos)
    u.uHover.value += (hoverAlvo - u.uHover.value) * (1 - Math.exp(-6 * dt));
    velGel += ((-u.uGel.value * 36) * dt) / 0.16;
    velGel *= Math.exp(-1.5 * dt);
    u.uGel.value += velGel * dt * 0.16;
    velGel2 += ((-u.uGel2.value * 52) * dt) / 0.12;
    velGel2 *= Math.exp(-1.8 * dt);
    u.uGel2.value += velGel2 * dt * 0.12;

    renderizador.render(cena, camera);
    quadroId = requestAnimationFrame(quadro);
  }

  /* ---------- 10. Início ---------- */
  addEventListener("resize", ajustarTamanho);
  ajustarTamanho();
  (async () => {
    try {
      await Promise.race([document.fonts.load(`800 100px ${fonte}`), dormir(1500)]);
    } catch {
      // segue com a fonte que houver
    }
    if (!vivo) return;
    sortearTexto(desenharMascara());
    ajustarTamanho(); // o cartão já está no lugar final
    relogio.start();
    quadroId = requestAnimationFrame(quadro);
    abertura();
  })();

  // Só para os testes de tela, fora de produção
  if (process.env.NODE_ENV !== "production") (window as unknown as { __esfera?: unknown }).__esfera = { u, caixaDaEsfera };

  return () => {
    vivo = false;
    cancelAnimationFrame(quadroId);
    timers.forEach(clearTimeout);
    removeEventListener("resize", ajustarTamanho);
    canvas.removeEventListener("pointerdown", aoApertar);
    canvas.removeEventListener("pointermove", aoMover);
    canvas.removeEventListener("pointerup", aoSoltar);
    canvas.removeEventListener("pointercancel", aoSoltar);
    canvas.removeEventListener("pointerleave", aoSair);
    geo.dispose();
    material.dispose();
    mascaraTex.dispose();
    renderizador.dispose();
    renderizador.forceContextLoss();
    canvas.remove();
  };
}
