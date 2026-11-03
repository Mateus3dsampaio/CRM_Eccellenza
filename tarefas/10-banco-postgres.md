# Tarefa 10 – Banco Postgres (item 2)
- Motivo: SQLite no Railway apaga os dados a cada deploy sem volume.
- Trocar o provider do Prisma para PostgreSQL; revisar listas guardadas como JSON em texto (`src/lib/json.ts`) e o que for específico do SQLite (`prisma/seed.ts`, `testes/unit/preparar.ts`, `testes/unit/ajuda.ts`).
- `.env.example` com `DATABASE_URL`. Migrações versionadas (`prisma migrate`) em vez de `db push`.
- Backup: documentar o backup automático do Railway e como restaurar. Não migrar dado real (só há seed).
- Atualizar `docs/mapa-do-codigo.md` (banco) e README (como rodar local).
- Pronto quando: `npm test` passa no Postgres e o sistema sobe com seed.
- Depende de: Mateus criar o Postgres no Railway (para validar fora daqui).
