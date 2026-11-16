// Exportação do Painel em um arquivo HTML que abre sozinho (sem internet, sem o CRM) e tem o mesmo filtro de período do Painel.
// Os dados vão dentro do arquivo; os cálculos rodam no navegador (SCRIPT abaixo). O teste `painel-exportado.test.ts` roda
// esse script contra os mesmos dados do Painel e confere que os números batem.
// Só números e códigos: nenhum nome, telefone ou texto de cliente.

export interface DadosDoPainelExportado {
  geradoEm: string;
  geradoEmTexto: string;
  zeradoEmTexto: string | null;
  /** Datas (AAAA-MM-DD) dos atalhos, calculadas no servidor. */
  atalhos: { codigo: string; nome: string; de: string; ate: string }[];
  consultores: { id: string; nome: string }[];
  motivos: { codigo: string; nome: string; pergunta: string | null }[];
  indicadores: { tipo: string; nome: string }[];
  funil: { tipo: string; nome: string }[];
  /** Contadores anônimos: tipo, vendedor e dia (AAAA-MM-DD, horário da loja). */
  eventos: { t: string; c: string | null; d: string }[];
  /** Leads que chegaram a Fechado ou Perdido, inclusive os já excluídos. */
  encerrados: { e: string; m: string | null; conc: string | null; v: number | null; d: string; c: string | null; nl: boolean }[];
  /** Medição e apresentação marcadas por lead: dia e instante (ms) em que foram marcadas. */
  compromissos: { c: string | null; md: string | null; mt: number | null; ad: string | null; at: number | null; f: boolean }[];
}

function escapar(texto: string): string {
  return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Dados dentro de <script type="application/json">: `<` e separadores de linha escapados para não fechar a tag. */
function jsonSeguro(valor: unknown): string {
  const barra = String.fromCharCode(92);
  const separadorDeLinha = new RegExp(String.fromCharCode(0x2028), "g");
  const separadorDeParagrafo = new RegExp(String.fromCharCode(0x2029), "g");
  return JSON.stringify(valor)
    .replace(/</g, barra + "u003c")
    .replace(separadorDeLinha, barra + "u2028")
    .replace(separadorDeParagrafo, barra + "u2029");
}

// Atenção ao editar: este texto é JavaScript puro do navegador. Sem crases e sem "${".
export const SCRIPT_DO_PAINEL_EXPORTADO = String.raw`
function criarPainel(D) {
  function dentro(dia, de, ate) { return (!de || dia >= de) && (!ate || dia <= ate); }
  function soma(lista, f) { var t = 0; for (var i = 0; i < lista.length; i++) t += f(lista[i]); return t; }
  function porMotivo(lista) {
    var conhecidos = {};
    D.motivos.forEach(function (m) { conhecidos[m.codigo] = true; });
    var todos = D.motivos.concat([{ codigo: "sem_motivo", nome: "Sem motivo registrado", pergunta: null }]);
    var saida = [];
    todos.forEach(function (m) {
      var doMotivo = lista.filter(function (l) { return conhecidos[l.m || ""] ? l.m === m.codigo : m.codigo === "sem_motivo"; });
      if (!doMotivo.length) return;
      var detalhes = [];
      if (m.pergunta) doMotivo.forEach(function (l) { var c = (l.conc || "").trim(); if (c && detalhes.indexOf(c) < 0) detalhes.push(c); });
      saida.push({ codigo: m.codigo, nome: m.nome, total: doMotivo.length, detalhes: detalhes });
    });
    return saida;
  }
  return function calcular(de, ate, vendedor) {
    var ok = function (x) { return dentro(x.d, de, ate) && (!vendedor || x.c === vendedor); };
    var eventos = D.eventos.filter(ok);
    var encerrados = D.encerrados.filter(ok);
    var contar = function (tipo) { return eventos.filter(function (e) { return e.t === tipo; }).length; };
    var descartados = encerrados.filter(function (e) { return e.e === "perdido" && e.nl; });
    var indicadores = D.indicadores.map(function (i) {
      var n = contar(i.tipo);
      if (i.tipo === "lead_novo") n = Math.max(0, n - descartados.length);
      return { tipo: i.tipo, nome: i.nome, total: n };
    });
    var funil = D.funil.map(function (f) { return { tipo: f.tipo, nome: f.nome, total: contar(f.tipo) }; });
    var fechados = encerrados.filter(function (e) { return e.e === "fechado"; });
    var perdidos = encerrados.filter(function (e) { return e.e === "perdido" && !e.nl; });
    var comp = D.compromissos.filter(function (c) { return !vendedor || c.c === vendedor; });
    var medicoes = comp.filter(function (c) { return c.md !== null && dentro(c.md, de, ate); });
    var apresentacoes = comp.filter(function (c) { return c.ad !== null && dentro(c.ad, de, ate); });
    var porConsultor = D.consultores.map(function (c) {
      return { nome: c.nome, total: D.eventos.filter(function (e) { return e.t === "apresentacao_agendada" && e.c === c.id && dentro(e.d, de, ate); }).length };
    });
    return {
      indicadores: indicadores,
      funil: funil,
      vendido: { quantidade: fechados.length, total: soma(fechados, function (l) { return l.v || 0; }) },
      perdidos: { quantidade: perdidos.length, motivos: porMotivo(perdidos) },
      descartados: { quantidade: descartados.length, motivos: porMotivo(descartados) },
      conversoes: {
        medicoes: medicoes.length,
        medicoesComApresentacao: medicoes.filter(function (c) { return c.at !== null && c.mt !== null && c.at >= c.mt; }).length,
        apresentacoes: apresentacoes.length,
        apresentacoesFechadas: apresentacoes.filter(function (c) { return c.f; }).length
      },
      porConsultor: porConsultor,
      recuperacao: { primeira: contar("recuperacao_primeira"), segunda: contar("recuperacao_segunda"), respondeuPrimeira: contar("recuperacao_respondeu_primeira"), respondeuSegunda: contar("recuperacao_respondeu_segunda"), perdidos: contar("recuperacao_perdido") },
      automacao: { desclassificados: contar("desclassificado_perdido"), redePerdidos: contar("rede_perdido"), redeArquivados: contar("rede_arquivado"), perdidosArquivados: contar("perdido_arquivado"), bloqueados: contar("contato_bloqueado") },
      lista: encerrados.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; })
    };
  };
}

function iniciarPagina() {
  var D = JSON.parse(document.getElementById("dados").textContent);
  var calcular = criarPainel(D);
  var $ = function (id) { return document.getElementById(id); };
  var reais = function (c) { return "R$ " + (c / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var num = function (n) { return n.toLocaleString("pt-BR"); };
  var taxa = function (a, b) { return b ? Math.round((a / b) * 100) + "%" : "–"; };
  var nomeConsultor = function (id) { for (var i = 0; i < D.consultores.length; i++) if (D.consultores[i].id === id) return D.consultores[i].nome; return "—"; };
  var nomeMotivo = function (cod) { for (var i = 0; i < D.motivos.length; i++) if (D.motivos[i].codigo === cod) return D.motivos[i].nome; return "Sem motivo registrado"; };
  var dataBr = function (d) { var p = d.split("-"); return p[2] + "/" + p[1] + "/" + p[0]; };
  var esc = function (t) { return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var todos = D.eventos.map(function (e) { return e.d; }).concat(D.encerrados.map(function (e) { return e.d; }));
  D.compromissos.forEach(function (c) { if (c.md) todos.push(c.md); if (c.ad) todos.push(c.ad); });
  todos.sort();
  var menor = todos.length ? todos[0] : "";
  var maior = todos.length ? todos[todos.length - 1] : "";
  var estado = { de: "", ate: "", vendedor: "", atalho: "tudo" };

  var barra = $("atalhos");
  var botoes = [{ codigo: "tudo", nome: "Tudo" }].concat(D.atalhos.map(function (a) { return { codigo: a.codigo, nome: a.nome }; }));
  botoes.forEach(function (b) {
    var el = document.createElement("button");
    el.type = "button"; el.textContent = b.nome; el.setAttribute("data-atalho", b.codigo);
    el.onclick = function () {
      estado.atalho = b.codigo;
      if (b.codigo === "tudo") { estado.de = ""; estado.ate = ""; }
      else { var a = D.atalhos.filter(function (x) { return x.codigo === b.codigo; })[0]; estado.de = a.de; estado.ate = a.ate; }
      $("de").value = estado.de; $("ate").value = estado.ate; desenhar();
    };
    barra.appendChild(el);
  });
  $("de").onchange = function () { estado.de = this.value; estado.atalho = ""; desenhar(); };
  $("ate").onchange = function () { estado.ate = this.value; estado.atalho = ""; desenhar(); };
  var sel = $("vendedor");
  D.consultores.forEach(function (c) { var o = document.createElement("option"); o.value = c.id; o.textContent = c.nome; sel.appendChild(o); });
  sel.onchange = function () { estado.vendedor = this.value; desenhar(); };

  function cartao(titulo, valor, nota) {
    return '<div class="cartao"><p class="t">' + esc(titulo) + '</p><p class="v">' + valor + '</p>' + (nota ? '<p class="n">' + nota + '</p>' : '') + '</div>';
  }
  function listaMotivos(motivos, vazio) {
    if (!motivos.length) return '<p class="n">' + vazio + '</p>';
    return '<ul>' + motivos.map(function (m) {
      return '<li><span>' + esc(m.nome) + '</span><b>' + num(m.total) + '</b>' + (m.detalhes.length ? '<small>' + esc(m.detalhes.join(", ")) + '</small>' : '') + '</li>';
    }).join("") + '</ul>';
  }
  function desenhar() {
    Array.prototype.forEach.call(barra.children, function (b) { b.className = b.getAttribute("data-atalho") === estado.atalho ? "ativo" : ""; });
    var r = calcular(estado.de, estado.ate, estado.vendedor);
    var periodo = (estado.de || estado.ate) ? (estado.de ? dataBr(estado.de) : "início") + " a " + (estado.ate ? dataBr(estado.ate) : "hoje") : (menor ? dataBr(menor) + " a " + dataBr(maior) : "sem dados");
    $("periodo").textContent = "Período: " + periodo + (estado.vendedor ? " · vendedor: " + nomeConsultor(estado.vendedor) : "");
    $("resultado").innerHTML =
      cartao("Total vendido", reais(r.vendido.total), num(r.vendido.quantidade) + (r.vendido.quantidade === 1 ? " venda fechada" : " vendas fechadas")) +
      cartao("Leads perdidos", num(r.perdidos.quantidade), "não inclui os descartados") +
      cartao("Descartados (não eram lead)", num(r.descartados.quantidade), "pós-venda, parceiro, emprego, canal errado");
    $("leads").innerHTML = r.indicadores.map(function (i) { return cartao(i.nome, num(i.total)); }).join("");
    $("motivos").innerHTML = '<h3>Motivos de perda</h3>' + listaMotivos(r.perdidos.motivos, "Nenhum lead perdido no período.") +
      '<h3>Descartados</h3>' + listaMotivos(r.descartados.motivos, "Nenhum descartado no período.");
    var c = r.conversoes;
    $("conversoes").innerHTML =
      cartao("Medições que viraram apresentação", taxa(c.medicoesComApresentacao, c.medicoes), c.medicoes ? num(c.medicoesComApresentacao) + " de " + num(c.medicoes) + " leads com medição marcada no período" : "nenhum lead com medição marcada no período") +
      cartao("Apresentações que viraram venda", taxa(c.apresentacoesFechadas, c.apresentacoes), c.apresentacoes ? num(c.apresentacoesFechadas) + " de " + num(c.apresentacoes) + " leads com apresentação marcada no período" : "nenhum lead com apresentação marcada no período");
    var rec = r.recuperacao, aut = r.automacao;
    $("recuperacao").innerHTML =
      cartao("Receberam a 1ª mensagem", num(rec.primeira)) +
      cartao("Receberam a 2ª mensagem", num(rec.segunda)) +
      cartao("Responderam depois da 1ª", num(rec.respondeuPrimeira), "de " + num(rec.primeira) + " enviadas") +
      cartao("Responderam depois da 2ª", num(rec.respondeuSegunda), "de " + num(rec.segunda) + " enviadas") +
      cartao("Foram para Perdido (automático)", num(rec.perdidos));
    $("automacao").innerHTML =
      cartao("Desclassificados para Perdido", num(aut.desclassificados), "outra cidade e curioso / sem perfil") +
      cartao("Rede de segurança: para Perdido", num(aut.redePerdidos), "parados com a IA além do prazo") +
      cartao("Rede de segurança: arquivados", num(aut.redeArquivados), "pós-venda parado") +
      cartao("Perdidos arquivados", num(aut.perdidosArquivados), "saíram da coluna Perdido sozinhos") +
      cartao("Contatos bloqueados", num(aut.bloqueados), "não eram clientes (pela IA ou à mão)");
    var maiorFunil = Math.max.apply(null, [1].concat(r.funil.map(function (f) { return f.total; })));
    $("funil").innerHTML = r.funil.map(function (f, i) {
      return '<li><div class="linha"><span>' + esc(f.nome) + '</span><b>' + num(f.total) + (i > 0 ? ' <small>' + taxa(f.total, r.funil[i - 1].total) + ' da etapa anterior</small>' : '') + '</b></div><div class="barra"><div style="width:' + (f.total / maiorFunil * 100) + '%"></div></div></li>';
    }).join("");
    $("consultores").innerHTML = r.porConsultor.map(function (x) { return '<li><span>' + esc(x.nome) + '</span><b>' + num(x.total) + '</b></li>'; }).join("");
    $("encerrados").innerHTML = r.lista.length ? r.lista.map(function (l) {
      var tipo = l.e === "fechado" ? "Fechado" : l.nl ? "Descartado" : "Perdido";
      return '<tr><td>' + dataBr(l.d) + '</td><td>' + tipo + '</td><td>' + (l.e === "fechado" ? "" : esc(nomeMotivo(l.m))) + (l.conc ? ' <small>(' + esc(l.conc) + ')</small>' : '') + '</td><td class="dir">' + (l.e === "fechado" && l.v ? reais(l.v) : "") + '</td><td>' + esc(l.c ? nomeConsultor(l.c) : "—") + '</td></tr>';
    }).join("") : '<tr><td colspan="5">Nenhum lead encerrado no período.</td></tr>';
  }
  desenhar();
}
if (typeof document !== "undefined" && document.getElementById("dados")) iniciarPagina();
`;

const ESTILO = `
:root{--fundo:#f6f5f2;--cartao:#fff;--texto:#1d1d1b;--suave:#5f5d57;--borda:#e1ded6;--marca:#8a5a2b;--barra:#ece8df}
@media (prefers-color-scheme:dark){:root{--fundo:#161513;--cartao:#211f1c;--texto:#f1efe9;--suave:#a9a69c;--borda:#38342e;--marca:#d29a5b;--barra:#2d2a25}}
*{box-sizing:border-box}body{margin:0;font:15px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;background:var(--fundo);color:var(--texto)}
main{max-width:1200px;margin:0 auto;padding:20px 16px 48px}h1{font-size:22px;margin:0 0 4px}h2{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--suave);margin:26px 0 10px}h3{font-size:14px;margin:12px 0 6px}
.sub{color:var(--suave);font-size:13px;margin:0 0 16px}.filtros{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;margin-bottom:6px}
.filtros label{display:flex;flex-direction:column;font-size:12px;color:var(--suave);gap:3px}
input,select{font:inherit;padding:6px 8px;border:1px solid var(--borda);border-radius:8px;background:var(--cartao);color:var(--texto)}
#atalhos{display:flex;gap:6px;flex-wrap:wrap}#atalhos button{font:inherit;padding:7px 12px;border:1px solid var(--borda);border-radius:999px;background:var(--cartao);color:var(--texto);cursor:pointer}
#atalhos button.ativo{background:var(--marca);border-color:var(--marca);color:#fff}
.grade{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
.cartao,.caixa{background:var(--cartao);border:1px solid var(--borda);border-radius:12px;padding:14px 16px}
.cartao .t{margin:0;color:var(--suave);font-size:13px}.cartao .v{margin:4px 0 0;font-size:28px;font-weight:650;font-variant-numeric:tabular-nums}.cartao .n,.n{margin:4px 0 0;color:var(--suave);font-size:12px}
ul{list-style:none;margin:0;padding:0}li{padding:4px 0}li>span{display:inline-block}li>b{float:right;font-variant-numeric:tabular-nums}li small{display:block;clear:both;color:var(--suave);font-size:12px}
.linha{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px}.barra{height:10px;background:var(--barra);border-radius:999px;overflow:hidden}.barra>div{height:10px;background:var(--marca);border-radius:999px}
.duas{display:grid;grid-template-columns:1.5fr 1fr;gap:12px}@media(max-width:800px){.duas{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:7px 8px;border-bottom:1px solid var(--borda)}th{color:var(--suave);font-weight:600;font-size:12px}.dir{text-align:right}
.aviso{margin-top:28px;color:var(--suave);font-size:12px}
`;

/** Monta o arquivo HTML inteiro (estilo, dados e script dentro dele). */
export function gerarHtmlDoPainel(dados: DadosDoPainelExportado): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Painel Eccellenza – exportado em ${escapar(dados.geradoEmTexto)}</title>
<style>${ESTILO}</style>
</head>
<body>
<main>
<h1>Painel da Eccellenza</h1>
<p class="sub">Exportado em ${escapar(dados.geradoEmTexto)}${dados.zeradoEmTexto ? ` · o painel foi zerado em ${escapar(dados.zeradoEmTexto)}, então só há dados depois disso` : ""}.</p>
<div class="filtros">
<div id="atalhos" role="group" aria-label="Atalhos de período"></div>
<label>De<input type="date" id="de"></label>
<label>Até<input type="date" id="ate"></label>
<label>Vendedor<select id="vendedor"><option value="">Todos</option></select></label>
</div>
<p class="sub" id="periodo"></p>
<h2>Resultado</h2><div class="grade" id="resultado"></div>
<h2>Leads no período</h2><div class="grade" id="leads"></div>
<h2>Recuperação de leads</h2><div class="grade" id="recuperacao"></div>
<h2>Automação de leads</h2><div class="grade" id="automacao"></div>
<h2>Conversão da agenda</h2><div class="grade" id="conversoes"></div>
<div class="duas">
<div><h2>Funil</h2><div class="caixa"><ul id="funil"></ul></div></div>
<div><h2>Apresentações agendadas por consultor</h2><div class="caixa"><ul id="consultores"></ul></div></div>
</div>
<h2>Motivos</h2><div class="caixa" id="motivos"></div>
<h2>Leads encerrados no período</h2>
<div class="caixa"><table><thead><tr><th>Data</th><th>Resultado</th><th>Motivo</th><th class="dir">Valor</th><th>Vendedor</th></tr></thead><tbody id="encerrados"></tbody></table></div>
<p class="aviso">Este arquivo traz só números e códigos: nenhum nome, telefone ou conversa de cliente. Não inclui tempo de resposta nem a situação das janelas de 24h (são dados de agora, não do período) e não compara com o período anterior. Com um vendedor escolhido, os números vêm dos contadores daquele vendedor.</p>
</main>
<script type="application/json" id="dados">${jsonSeguro({ ...dados, geradoEm: undefined })}</script>
<script>${SCRIPT_DO_PAINEL_EXPORTADO}</script>
</body>
</html>
`;
}
