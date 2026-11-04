# Tarefa 31 – Configurações: submenu vertical e barra de salvar

Série de layout (23–33). **Status: a fazer.**

## Problema
Seis abas horizontais com páginas longas e vários botões "Salvar" espalhados (Salvar prazos, depois Salvar agenda…). Fácil editar e sair sem salvar. "Exportar desempenho" é uma ação, não configuração.

## O que fazer
- Abas viram um **submenu vertical à esquerda** da área de conteúdo (dentro da tela, não no menu lateral do app): Geral, Vendas, Equipe, Instruções de atendimento, Chaves de API, WhatsApp, Armazenamento, Temas. Ordem e nomes conforme o que existe em `src/componentes/configuracoes/`; itens que só aparecem em produção (WhatsApp, Armazenamento) seguem a regra atual de exibição.
- "Exportar desempenho" sai daqui e vai para o Painel (tarefa 30).
- Cada seção longa (ex.: Geral) fica com uma **barra fixa no rodapé** que aparece só quando algo mudou: "Alterações não salvas · Descartar · Salvar". Os botões "Salvar" individuais somem; um salvar grava tudo da seção. Sair da seção com mudança pendente pergunta antes.
- Instruções de atendimento continuam com o salvar próprio por instrução (editor de texto longo), mas dentro do mesmo visual.
- A URL guarda a seção (`/configuracoes?secao=vendas`) para F5 voltar no lugar.
- Largura: conteúdo com máximo ~900px, submenu ~220px; no celular o submenu vira lista no topo.

## Onde mexer
`src/componentes/configuracoes/configuracoes.tsx` (estrutura) e cada seção para plugar na barra de salvar. Componente novo: `src/componentes/configuracoes/barra-salvar.tsx`.

## Testes e documentação
- Tela: mudar um prazo → barra aparece → Salvar grava e barra some; trocar de seção com mudança pendente pergunta.
- `docs/mapa-do-codigo.md` (arquivo novo, Exportar movido).

## Pronto quando
Não existe mais "Salvar" solto no meio da página, e nenhuma alteração se perde sem aviso.
