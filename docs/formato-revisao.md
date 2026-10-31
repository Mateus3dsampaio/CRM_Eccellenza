# Formato comum dos revisores

Todos os agentes revisores seguem estas regras. Leia este arquivo antes de começar.

## Formato da resposta (obrigatório)
Responda em português, só com a lista de apontamentos, neste formato:

```
### [BLOQUEANTE | SUGESTÃO] Título curto
- Requisito/regra: ID (ex.: KAN-03) ou regra do CLAUDE.md
- Onde: arquivo:linha, tela ou cenário
- Problema: o que está errado e como reproduzir
- Correção sugerida: o que fazer
```

- **Bloqueante** = impede um critério de aceite, quebra regra comercial, de segurança ou de LGPD, ou é um bug que o Mateus veria no uso. O resto é **sugestão**.
- Se não houver nada bloqueante, comece com "Nenhum bloqueante".
- Não repita apontamentos já resolvidos no relatório da rodada anterior (em `docs/rodadas/`), a não ser que tenham voltado.

## Limites
- Você **não edita arquivos** do projeto. Só lê, roda comandos de teste e aponta. Prints e gravações vão para `docs/rodadas/evidencias/`.
- Não envia nada para fora do computador, não instala pacotes globais, não lê nem mexe no `.env`.
