/**
 * Shaders da esfera de pontos do login (placa de vídeo). Usados por `esfera-3d.ts`.
 * Vértice: mistura nuvem → nome → esfera, onda, mouse, toques de gel, esticão, aperto e o contato
 * (nenhum ponto passa da borda da tela nem entra no cartão do login, com o canto arredondado dele).
 */
export const SHADER_VERTICE = /* glsl */ `
    uniform float uTempo, uRaio, uTextoLarg, uNomeLarg, uMascAspecto, uPixel, uA, uB, uHover;
    uniform float uOnda, uOndaForca, uOndaNome, uRevela, uRevelaNome, uGel, uGel2;
    uniform vec3 uMouse, uRevelaCentro, uGelEixo, uGelEixo2, uCorBaixo, uCorCima, uCorBrilho, uCorNome;
    uniform vec4 uToques[4];
    uniform float uToquesForca[4];
    uniform vec3 uCentro, uPuxao, uAgarre, uVel;
    uniform vec2 uTela;
    uniform vec4 uCartao;
    uniform float uRaioCartao;
    uniform float uContato;
    uniform vec4 uAperto;
    uniform vec2 uCentroPx;
    uniform mat3 uRot;
    uniform sampler2D uMascara;
    attribute vec3 aEsfera, aTexto, aNuvem;
    attribute float aAleat;
    varying vec3 vCor;

    float suave(float t) { return t * t * (3.0 - 2.0 * t); }

    void main() {
      vec3 n = normalize(uRot * aEsfera);   // direção do ponto, já girada
      vec3 base = n * uRaio;
      float desl = 0.0, brilho = 0.0;

      // Vida: respiração leve e irregular
      desl += 0.016 * sin(dot(aEsfera, vec3(4.1, 3.3, 2.7)) * 2.0 + uTempo * 1.4);

      // Onda que sobe de baixo para cima
      float dOnda = n.y - uOnda;
      float onda = exp(-dOnda * dOnda / 0.035) * uOndaForca;
      desl += onda * 0.05;
      brilho += onda * 0.9;

      // Mouse: estufa e brilha
      float dm = distance(base + uCentro, uMouse) / uRaio;
      float h = exp(-dm * dm / 0.14) * uHover;
      desl += h * 0.15;
      brilho += h * 1.8;

      // Toques: ondas de gel saindo do ponto tocado
      for (int i = 0; i < 4; i++) {
        vec4 tq = uToques[i];
        float t = uTempo - tq.w;
        if (t < 0.0 || t > 5.0) continue;
        float ang = acos(clamp(dot(n, tq.xyz), -1.0, 1.0));
        float x = ang - t * 1.25;
        float env = exp(-x * x / 0.6) * exp(-t * 0.75);
        float s = sin(x * 6.0);
        float f = uToquesForca[i];
        desl += s * env * 0.12 * f;
        // afunda onde tocou e volta quicando, como geleia
        desl -= exp(-ang * ang / 0.09) * exp(-t * 2.2) * cos(t * 7.5) * 0.3 * f;
        brilho += env * abs(s) * 1.1 * min(f, 1.6);
      }
      // Gelatina: amassa e estica no eixo do toque
      float c = dot(n, uGelEixo);
      desl += uGel * (c * c - 0.33);
      float c2 = dot(n, uGelEixo2);                  // segundo balanço, de lado e em outro ritmo
      desl += uGel2 * (c2 * c2 - 0.33);
      // Prensada: o lado do contato achata (o shader corta na face) e o resto estufa para os lados, como gel
      float cA = dot(n, uAperto.xyz);
      desl += uAperto.w * 0.6 * (1.0 - cA * cA);

      // Nome na esfera: pontos dentro das letras (vistos de frente) acendem quando a onda ou o toque passam
      vec2 uv = vec2(base.x / (uNomeLarg * uRaio) + 0.5, base.y * uMascAspecto / (uNomeLarg * uRaio) + 0.5);
      float dentro = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
      float letra = texture2D(uMascara, uv).r * dentro * smoothstep(0.15, 0.45, n.z);
      float acesoOnda = smoothstep(0.0, 0.18, uOnda - n.y) * uOndaNome;
      float acesoToque = smoothstep(0.0, 0.35, uRevela - distance(n, uRevelaCentro)) * uRevelaNome;
      float aceso = max(acesoOnda, acesoToque);
      float nome = letra * aceso;
      desl += nome * 0.05;

      vec3 esfera = base * (1.0 + clamp(desl, -0.6, 0.9));
      // Tecido: o ponto agarrado vai com o dedo e a vizinhança vem junto, cada vez menos quanto mais longe
      float dA = distance(base, uAgarre) / uRaio;
      esfera += uPuxao * exp(-dA * dA / 0.9);
      // Em movimento, o lado de trás atrasa um pouco (estica no sentido da velocidade)
      float vl = length(uVel);
      if (vl > 0.001) esfera -= uVel * 0.07 * (0.5 - 0.5 * dot(n, uVel / vl));
      esfera += uCentro;

      // Mistura nuvem → nome → esfera, cada ponto no seu tempo (atraso aleatório e da esquerda para a direita)
      vec3 texto = vec3(aTexto.xy * uTextoLarg, aTexto.z * uRaio * 0.08);
      vec3 nuvem = aNuvem * uRaio * 3.2;
      float eA = suave(clamp(uA * 1.6 - aAleat * 0.6, 0.0, 1.0));
      float eB = suave(clamp(uB * 1.7 - aAleat * 0.35 - (aTexto.x + 0.5) * 0.35, 0.0, 1.0));
      vec3 p = mix(mix(nuvem, texto, eA), esfera, eB);
      // no caminho entre o nome e a esfera, os pontos fazem uma curva em vez de ir em linha reta
      p += vec3(0.0, 0.0, sin(eB * 3.14159) * uRaio * 0.9 * (aAleat - 0.3));

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      vec4 clip = projectionMatrix * mv;

      // Contato: nenhum ponto passa da borda da tela nem entra no cartão. Quem passaria fica em cima da face,
      // por isso a esfera amassa reta numa parede e o canto do cartão afunda nela. Conta feita em pixels da tela.
      vec2 px0 = vec2((clip.x / clip.w + 1.0) * 0.5 * uTela.x, (1.0 - clip.y / clip.w) * 0.5 * uTela.y);
      vec2 px = clamp(px0, vec2(2.0), uTela - 2.0);
      // Cantos arredondados (mesmo raio do CSS): no quadradinho de cada canto, o cartão é um quarto de círculo.
      // Ponto dentro dele vai para a borda do arco (direção do centro do arco); fora dele, não encosta.
      vec2 cE = vec2(uCartao.x + uRaioCartao, uCartao.y + uRaioCartao), cD = vec2(uCartao.z - uRaioCartao, uCartao.w - uRaioCartao);
      bool noCartao = px.x > uCartao.x && px.x < uCartao.z && px.y > uCartao.y && px.y < uCartao.w;
      bool noCanto = noCartao && (px.x < cE.x || px.x > cD.x) && (px.y < cE.y || px.y > cD.y);
      if (noCanto) {
        vec2 centroArco = vec2(px.x < cE.x ? cE.x : cD.x, px.y < cE.y ? cE.y : cD.y);
        vec2 dA = px - centroArco;
        float lA = length(dA);
        if (lA < uRaioCartao) px = centroArco + (lA > 0.001 ? dA / lA : normalize(uCentroPx - centroArco)) * uRaioCartao;
      } else if (noCartao) {
        // vai para a face do lado em que a esfera está (as outras faces ficam fora da conta);
        // no canto valem as duas faces daquele canto, e ganha a mais perto: o canto afunda na esfera
        float longe = 1e5;
        float dE = uCentroPx.x < uCartao.x ? px.x - uCartao.x : longe;
        float dD = uCentroPx.x > uCartao.z ? uCartao.z - px.x : longe;
        float dC = uCentroPx.y < uCartao.y ? px.y - uCartao.y : longe;
        float dB = uCentroPx.y > uCartao.w ? uCartao.w - px.y : longe;
        if (min(min(dE, dD), min(dC, dB)) >= longe) {   // centro dentro do cartão (raro): face mais perto
          dE = px.x - uCartao.x; dD = uCartao.z - px.x; dC = px.y - uCartao.y; dB = uCartao.w - px.y;
        }
        float m = min(min(dE, dD), min(dC, dB));
        if (m == dC) px.y = uCartao.y;
        else if (m == dB) px.y = uCartao.w;
        else if (m == dE) px.x = uCartao.x;
        else px.x = uCartao.z;
      }
      px = mix(px0, px, uContato);
      clip.xy = vec2(px.x / uTela.x * 2.0 - 1.0, 1.0 - px.y / uTela.y * 2.0) * clip.w;
      gl_Position = clip;
      float amassado = clamp(length(px - px0) / 24.0, 0.0, 1.0);   // pontos prensados brilham um pouco

      float frente = mix(0.18, 1.0, smoothstep(-0.75, 0.6, n.z));       // pontos de trás mais apagados
      // enquanto o nome está aceso, o resto da esfera apaga um pouco para as letras aparecerem
      float prof = mix(1.0, frente * (1.0 - 0.55 * max(uOndaNome * smoothstep(-0.2, 0.2, uOnda - n.y), uRevelaNome) * smoothstep(0.1, 0.5, n.z) * (1.0 - letra)), eB);
      gl_PointSize = uPixel * (1.0 + (h * 0.7 + nome * 1.4 + onda * 0.35) * eB) * (10.0 / -mv.z);

      vec3 corEsfera = mix(uCorBaixo, uCorCima, n.y * 0.5 + 0.5) + uCorBrilho * brilho * 0.55;
      corEsfera = mix(corEsfera, uCorNome * 1.5, nome);
      vec3 corNome = uCorNome * mix(0.35, 1.0, eA);
      vCor = mix(corNome, corEsfera, eB) * prof + uCorBrilho * amassado * 0.5;
    }
  `;

export const SHADER_FRAGMENTO = /* glsl */ `
    varying vec3 vCor;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      float a = smoothstep(0.5, 0.12, d);
      if (a < 0.02) discard;
      gl_FragColor = vec4(vCor * a, a);
      #include <colorspace_fragment>
    }
  `;
