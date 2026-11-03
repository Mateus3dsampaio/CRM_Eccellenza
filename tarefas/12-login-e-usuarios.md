# Tarefa 12 – Login seguro e usuários (item 4)
- Cookie com `secure` em produção; limite de tentativas por usuário/IP no login.
- Tela (admin) para criar, desativar e redefinir senha de usuários; tela "trocar minha senha". Hoje só o seed cria usuário.
- Seed com senhas de teste NÃO roda em produção; primeiro admin criado por variável de ambiente ou comando único.
- Cabeçalhos de segurança básicos no `next.config.ts`.
- Pronto quando: testes de limite de tentativas, permissão (só admin cria usuário) e senha trocada.
- Depende de: você escolher/guardar as senhas reais.
