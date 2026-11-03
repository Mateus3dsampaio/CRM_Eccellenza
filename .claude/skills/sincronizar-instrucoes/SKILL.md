---
name: sincronizar-instrucoes
description: Atualiza a cópia de testes/cenarios.md a partir do projeto de origem (agente do WhatsApp) e mostra o que mudou nas instruções e na loja. Tudo o que o bot segue (instruções, dados da loja e regras do CRM) vive no banco do CRM e não é mais sincronizado. Uso: /sincronizar-instrucoes [caminho da origem, opcional]
---

Atualize as cópias das instruções a partir do projeto de origem. Caminho da origem: $ARGUMENTS ou, se vazio, o que está em `agente/ORIGEM.md`.

1. Confira se o caminho de origem existe e tem `instrucoes/`, `contexto/loja.md` e `testes/cenarios.md`. Se não existir, pare e peça o caminho ao Mateus.
2. Mostre ao Mateus o que mudou, arquivo por arquivo (arquivos novos, removidos e alterados, com o trecho que mudou), **antes de copiar**.
3. Com o "pode copiar" do Mateus:
   - **Não** substitua `agente/instrucoes/` nem mexa nas instruções do banco: o CRM é a única fonte do que o bot segue (editado em Configurações). Se a origem tiver mudado alguma instrução ou o `contexto/loja.md` (que no CRM é a instrução 14, Dados da loja), mostre ao Mateus o trecho e deixe que ele aplique pela tela.
   - Copie só `testes/cenarios.md` para `testes/cenarios.md`.
   - Atualize `agente/ORIGEM.md` com a data de hoje e o commit atual da origem (`git log -1` na pasta de origem).
4. Leia as instruções 14 e 15 do banco (ou `agente/instrucoes/14-*` e `15-*`) e verifique se algo novo da origem conflita com elas. Se conflitar, avise e proponha o ajuste, sem alterar.
5. Nunca altere nada no projeto de origem.
