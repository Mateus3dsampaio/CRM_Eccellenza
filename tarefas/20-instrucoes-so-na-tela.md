# Tarefa 20 – Instruções só na tela (sem cópia no projeto)

## Por quê
O Mateus mantém as instruções de atendimento em outro repositório (com um agente próprio que analisa casos e atualiza o texto) e cola o resultado em Configurações > Instruções de atendimento. A cópia em `agente/instrucoes/` está desatualizada e confunde. Decisão do Mateus (04/11/2026): **toda regra do bot fica em instrução editável na tela; nada de regra do bot no código nem em arquivo do projeto.**

## O que muda

### 1. Instruções numeradas: só as que o Mateus cola
- Apagar `agente/instrucoes/` (01 a 15) e `agente/ORIGEM.md`.
- `src/servicos/instrucoes.ts`: tirar a carga inicial a partir dos arquivos. Banco vazio continua vazio.
- **Sem instrução ativa** (aprovado pelo Mateus): o bot não responde; o lead vai direto para o consultor ("Pronto para o consultor", aguardando humano) com a anotação "Bot sem instruções cadastradas". A tela de Instruções mostra o aviso "Cole as instruções de atendimento para o bot começar a atender".
- A 14 (Dados da loja) deixa de existir: o conteúdo que o bot precisa já está nas 01–13 do Mateus (13 endereço/horário, 02 e 06 cidades, 03 faixas, 09 pagamento, 10 prazo, 12 sem custo/na loja, 01 anúncio). Conferido em 04/11/2026.
- Apagar `CIDADES_ATENDIDAS` de `src/regras/etapas.ts` (não é usada). Cidades e faixas só nas instruções.

### 2. Manual do CRM (instrução fixa, editável)
- Um campo próprio na mesma tela, **fora da lista numerada**, com título "Manual do CRM". Editável pelo admin, guarda a versão anterior (igual às instruções), pode exportar. Não pode ser excluído nem desativado (sem ele o bot não preenche a ficha).
- Vai no prompt **depois** das instruções numeradas.
- Texto inicial: a proposta aprovada da antiga 15 (sem agendamento: "você não marca visitas, medições nem apresentações; quem agenda é o consultor"; preferência de dia vai para observações). É o único texto que o CRM traz pronto, gravado no banco só quando o manual ainda não existe.
- **Bancos que já existem:** a instrução "15. REGRAS DO CRM E FERRAMENTAS" vira o Manual do CRM (com o texto novo) e a "14. DADOS DA LOJA" é removida da lista; as 01–13 ficam como estão (o Mateus cola as dele por cima). Feito uma única vez, automaticamente.
- Regra para o futuro: quando uma ferramenta do bot mudar, o Claude propõe o texto novo do manual, o Mateus aprova e a mudança é aplicada.

### 3. Bot sem agendamento (opção b, aprovada)
- Tirar as ferramentas `ver_horarios_livres` e `agendar_visita` do bot (`src/bot/`). Quem agenda é o consultor, pela agenda.
- Instrução 05 aprovada pelo Mateus (vai no repositório dele e é colada na tela):
  - Convite: "Nosso projeto e orçamento são sem custo 😊 Eles são apresentados pessoalmente aqui na loja, assim você conhece nossos produtos de perto e tira todas as suas dúvidas. Vou passar seu contato para o nosso consultor, que vai combinar com você o melhor dia, tudo bem?"
  - Cliente sugere dia: "Anotado! O consultor confirma com você." (preferência vai para observações).

### 4. Testes e documentação
- Roteiro de exemplo para os testes em `testes/` (marcado "exemplo para teste, não é o que o bot usa"). Os testes nunca leem as instruções reais.
- Apagar o comando `/sincronizar-instrucoes` (`.claude/skills/sincronizar-instrucoes/`) e tirar as referências em `ciclo`, `cliente-simulado`, `revisor-requisitos`.
- Atualizar `CLAUDE.md` (seção "Instruções do bot"), `docs/mapa-do-codigo.md`, `docs/requisitos.md`, `docs/briefing.md`, `docs/pendencias.md`.
- `testes/cenarios.md`: ver se continua útil sem a sincronização; se não, sai.

## Pronto quando
- Projeto sem nenhuma cópia das instruções de atendimento.
- Banco vazio: bot repassa ao consultor e a tela avisa.
- Manual do CRM aparece separado, editável, e vai no prompt.
- Bot não oferece nem marca horário.
- Testes passando; mapa do código atualizado.
