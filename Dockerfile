# Imagem para o Railway. Passo a passo em docs/colocar-no-ar.md.
FROM node:22-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Dependências primeiro (aproveita o cache quando só o código muda). O prisma/ precisa estar aqui por causa do postinstall.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

COPY . .
# Em produção o banco é Postgres: gera o cliente do esquema Postgres e compila o sistema.
RUN npx prisma generate --schema prisma/postgres/schema.prisma && npm run build

ENV NODE_ENV=production
EXPOSE 3000
# Ao subir: aplica as migrações do banco (só adiciona o que falta, nunca apaga dados) e inicia o sistema.
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/postgres/schema.prisma && npm start"]
