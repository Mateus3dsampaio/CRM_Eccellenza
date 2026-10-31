---
name: sincronizar-instrucoes
description: Atualiza as cópias de agente/loja.md e testes/cenarios.md a partir do projeto de origem (agente do WhatsApp). As instruções 01 a 13 agora vivem no banco do CRM e não são mais sincronizadas. Uso: /sincronizar-instrucoes [caminho da origem, opcional]
---

Atualize as cópias das instruções a partir do projeto de origem. Caminho da origem: $ARGUMENTS ou, se vazio, o que está em `agente/ORIGEM.md`.

1. Confira se o caminho de origem existe e tem `instrucoes/`, `contexto/loja.md` e `testes/cenarios.md`. Se não existir, pare e peça o caminho ao Mateus.
2. Mostre ao Mateus o que mudou, arquivo por arquivo (arquivos novos, removidos e alterados, com o trecho que mudou), **antes de copiar**.
3. Com o "pode copiar" do Mateus:
   - **Não** substitua `agente/instrucoes/` nem mexa nas instruções do banco: desde 31/10/2026 o CRM é a fonte delas (editadas em Configurações). Se a origem tiver mudado alguma instrução, mostre ao Mateus o trecho e deixe que ele aplique pela tela.
   - Copie `contexto/loja.md` para `agente/loja.md` e `testes/cenarios.md` para `testes/cenarios.md`.
   - Atualize `agente/ORIGEM.md` com a data de hoje e o commit atual da origem (`git log -1` na pasta de origem).
4. Leia `agente/complemento-crm.md` e verifique se alguma instrução nova ou alterada conflita com ele. Se conflitar, avise e proponha o ajuste, sem alterar.
5. Nunca altere nada no projeto de origem.
