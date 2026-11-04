# Tarefa 26 – Barra de cima: rótulos e menu do avatar

Série de layout (23–33). **Status: a fazer.**

## Problema
Dois botões coloridos só com ícone e número (amarelo = retornos de hoje, vermelho = esperando resposta) não dizem o que são. "Trocar senha" e "Sair" ocupam a barra o dia inteiro sem precisar.

## O que fazer
- Em telas a partir de 1280px os dois botões mostram texto: **"Retornos 2"** e **"Esperando 5"**. Abaixo disso, só ícone com tooltip (como hoje).
- **Menu do avatar**: clicar na bolinha com a inicial abre um menu pequeno com nome e perfil, "Trocar minha senha", "Tema" (claro/escuro, o que já existe em Configurações > Temas, só o atalho) e "Sair". Somem os dois ícones de chave e sair da barra.
- Ordem final na barra, da esquerda para a direita: título da tela · (relógio do simulador) · Retornos · Esperando · (Almoço, consultor) · Nova mensagem · Sino · Avatar.
- O relógio do simulador continua só no simulador/telas largas, como hoje.

## Onde mexer
`src/componentes/cabecalho.tsx`, `src/componentes/retornos.tsx`, `src/componentes/aguardando.tsx`. Componente novo pequeno: `src/componentes/menu-usuario.tsx`.

## Testes e documentação
- Tela: em 1440 os textos "Retornos" e "Esperando" aparecem; clicar no avatar mostra "Sair"; sair funciona.
- `docs/mapa-do-codigo.md` (arquivo novo).

## Pronto quando
Quem nunca usou o CRM entende os dois botões coloridos sem passar o mouse, e a barra tem dois ícones a menos.
