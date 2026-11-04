# Etapa 4: código

## Já feito no computador (04/11/2026), NÃO enviado ao Git nem ao Railway
- Página pública `/exclusao-de-dados` (`src/app/exclusao-de-dados/page.tsx`), com o texto em `src/regras/privacidade.ts` (`secoesExclusao`).
- Link na seção "Seus direitos" de `/privacidade`.
- Teste `testes/unit/privacidade.test.ts` e atualização de `docs/mapa-do-codigo.md`.
- Conferido: testes de privacidade e do mapa passam; verificação de tipos (tsc) sem erro. Não rodei a suíte completa nem testei a página no navegador.

## Falta (depende da sua aprovação)
- [x] Você aprovar os textos (`02-textos-para-aprovar.md`). Aprovado em 05/11/2026; marcador PROVISÓRIO tirado do código.
- [ ] Você autorizar o push (commit na branch de trabalho e subida para o Railway). Depois do deploy, abrir `https://crmeccellenza-production.up.railway.app/exclusao-de-dados` e `/privacidade` para conferir.
- [ ] Trocar os textos de `src/regras/modelos.ts` pelos modelos aprovados (`03-modelos-de-mensagem.md`) e subir.
- [ ] Testar o envio de um modelo com botões depois de aprovado na Meta.
- [ ] Opcional: variáveis nos modelos (data e hora no lembrete da visita).
- [x] Aviso do Web Push, encarregado e data na política: decidido que NÃO entram (05/11/2026).
- [ ] Atualizar `docs/pendencias.md` e `docs/colocar-no-ar.md` ao concluir.

## Observação
Enquanto `PRIVACIDADE_APROVADA=1` estiver definido no Railway, as páginas não mostram o aviso de rascunho. Só suba depois de aprovar o texto.
