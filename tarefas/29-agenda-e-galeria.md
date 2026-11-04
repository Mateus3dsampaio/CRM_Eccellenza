# Tarefa 29 – Ajustes de layout: Agenda e Galeria

Série de layout (23–33). **Status: feito em 04/11/2026.** `Dica` (ⓘ com tooltip) nova em `ui.tsx`; na Galeria o aviso dos 180 dias também virou ⓘ ao lado da contagem.

## Agenda
- A linha "Regras da agenda (o administrador muda em Configurações): seg, ter… Clique no + …" é cortada com reticências. Trocar por um **ícone ⓘ** ao lado do título do período, com tooltip com o texto completo; para o admin, o tooltip tem o link "Alterar em Configurações".
- Clicar num compromisso abre a **gaveta do lead** (tarefa 23). Bloqueios (almoço, treinamento) continuam abrindo a janela atual.
- Conferir que os chips de consultor (Todos / Beatriz / Rafael) com a bolinha colorida são a legenda das cores; se o consultor for filtrado, os demais somem do calendário (já é assim; só confirmar).

## Galeria
- O select "Todos os vendedores" esticado na largura inteira vira um **select compacto** na mesma linha das abas Tudo / Imagens / Vídeos / Documentos, com a contagem "0 arquivos" à direita na mesma linha.
- O aviso "Arquivos com mais de 180 dias são apagados…" vira texto pequeno abaixo da linha de filtros ou tooltip ⓘ, não uma linha própria.
- Clicar no nome do cliente num arquivo abre a gaveta do lead (tarefa 23).

## Onde mexer
`src/componentes/agenda/agenda.tsx`, `src/componentes/galeria/galeria.tsx`, `src/componentes/ui.tsx` (Tooltip genérico, se não existir).

## Testes
- Tela: a Agenda não tem texto cortado em 1280×720; a Galeria tem filtros numa linha só.

## Pronto quando
Nenhum texto cortado na Agenda e a Galeria abre com filtros numa linha compacta.
