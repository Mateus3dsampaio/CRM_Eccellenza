-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "perfil" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'online',
    "almocoSeq" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "nomePerfil" TEXT,
    "nome" TEXT,
    "avatarCor" INTEGER NOT NULL DEFAULT 0,
    "cidade" TEXT,
    "endereco" TEXT,
    "ambientes" TEXT NOT NULL DEFAULT '[]',
    "exigencias" TEXT NOT NULL DEFAULT '[]',
    "situacaoImovel" TEXT,
    "prazo" TEXT,
    "investimento" TEXT,
    "pedidosTecnicos" TEXT NOT NULL DEFAULT '[]',
    "observacoes" TEXT,
    "classificacao" TEXT,
    "resumo" TEXT,
    "etapa" TEXT NOT NULL DEFAULT 'novo',
    "etapaAnterior" TEXT,
    "ordem" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "etiquetas" TEXT NOT NULL DEFAULT '[]',
    "proximoContatoEm" TIMESTAMP(3),
    "valorOrcamento" INTEGER,
    "valorFechado" INTEGER,
    "motivoPerda" TEXT,
    "concorrente" TEXT,
    "alertaContatoPara" TIMESTAMP(3),
    "consultorId" TEXT,
    "modoAtendimento" TEXT NOT NULL DEFAULT 'bot',
    "aguardandoHumano" BOOLEAN NOT NULL DEFAULT false,
    "repassadoEm" TIMESTAMP(3),
    "esperandoDesde" TIMESTAMP(3),
    "naoLidas" INTEGER NOT NULL DEFAULT 0,
    "alertaPrazoPara" TIMESTAMP(3),
    "erroBot" TEXT,
    "naoReceberEm" TIMESTAMP(3),
    "ultimaMensagemEm" TIMESTAMP(3),
    "ultimaMensagemPrevia" TEXT,
    "ultimaMsgClienteEm" TIMESTAMP(3),
    "ultimaMsgLojaEm" TIMESTAMP(3),
    "retomadaEnviadaEm" TIMESTAMP(3),
    "avisoAlmocoSeq" INTEGER,
    "semRespostaEm" TIMESTAMP(3),
    "marcasMetricas" TEXT NOT NULL DEFAULT '[]',
    "arquivadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MudancaEtapa" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "de" TEXT,
    "para" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MudancaEtapa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mensagem" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "autorNome" TEXT,
    "texto" TEXT,
    "midiaArquivo" TEXT,
    "midiaTipo" TEXT,
    "modelo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'enviado',
    "enviadaEm" TIMESTAMP(3) NOT NULL,
    "entregueEm" TIMESTAMP(3),
    "lidaEm" TIMESTAMP(3),
    "processadaPeloBot" BOOLEAN NOT NULL DEFAULT false,
    "idExterno" TEXT,

    CONSTRAINT "Mensagem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alerta" (
    "id" SERIAL NOT NULL,
    "tipo" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "leadNome" TEXT NOT NULL,
    "consultorId" TEXT,
    "consultorNome" TEXT,
    "texto" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alerta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConversaApi" (
    "leadId" TEXT NOT NULL,
    "mensagens" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "ConversaApi_pkey" PRIMARY KEY ("leadId")
);

-- CreateTable
CREATE TABLE "Medida" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ambiente" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "fonte" TEXT NOT NULL,
    "origem" TEXT NOT NULL DEFAULT 'informada pelo cliente',
    "confirmada" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medida_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "autorNome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alteracao" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "autor" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Alteracao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visita" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "consultorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'agendada',
    "tipo" TEXT NOT NULL DEFAULT 'visita',
    "vagaChave" TEXT,
    "criadoPor" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visita_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueio" (
    "id" TEXT NOT NULL,
    "consultorId" TEXT NOT NULL,
    "inicio" TIMESTAMP(3) NOT NULL,
    "fim" TIMESTAMP(3) NOT NULL,
    "motivo" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bloqueio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoMetrica" (
    "id" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "consultorId" TEXT,
    "ocorridoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventoMetrica_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Configuracao" (
    "chave" TEXT NOT NULL,
    "valor" TEXT NOT NULL,

    CONSTRAINT "Configuracao_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "RegistroRotina" (
    "id" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RegistroRotina_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotivoPerda" (
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "pergunta" TEXT,
    "ordem" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MotivoPerda_pkey" PRIMARY KEY ("codigo")
);

-- CreateTable
CREATE TABLE "Instrucao" (
    "id" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "anteriorTitulo" TEXT,
    "anteriorTexto" TEXT,
    "anteriorEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Instrucao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UsoApi" (
    "id" SERIAL NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL,
    "entrada" INTEGER NOT NULL,
    "saida" INTEGER NOT NULL,
    "cacheLeitura" INTEGER NOT NULL DEFAULT 0,
    "cacheEscrita" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UsoApi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LogWebhook" (
    "id" SERIAL NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tipo" TEXT NOT NULL,
    "resumo" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LogWebhook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoLgpd" (
    "id" SERIAL NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acao" TEXT NOT NULL,
    "quem" TEXT NOT NULL,
    "telefoneFim" TEXT NOT NULL,

    CONSTRAINT "PedidoLgpd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_login_key" ON "Usuario"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_telefone_key" ON "Lead"("telefone");

-- CreateIndex
CREATE INDEX "MudancaEtapa_leadId_criadoEm_idx" ON "MudancaEtapa"("leadId", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "Mensagem_idExterno_key" ON "Mensagem"("idExterno");

-- CreateIndex
CREATE INDEX "Mensagem_leadId_enviadaEm_idx" ON "Mensagem"("leadId", "enviadaEm");

-- CreateIndex
CREATE UNIQUE INDEX "Visita_vagaChave_key" ON "Visita"("vagaChave");

-- CreateIndex
CREATE INDEX "EventoMetrica_tipo_ocorridoEm_idx" ON "EventoMetrica"("tipo", "ocorridoEm");

-- CreateIndex
CREATE INDEX "UsoApi_criadoEm_idx" ON "UsoApi"("criadoEm");

-- CreateIndex
CREATE INDEX "LogWebhook_criadoEm_idx" ON "LogWebhook"("criadoEm");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_consultorId_fkey" FOREIGN KEY ("consultorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MudancaEtapa" ADD CONSTRAINT "MudancaEtapa_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mensagem" ADD CONSTRAINT "Mensagem_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConversaApi" ADD CONSTRAINT "ConversaApi_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medida" ADD CONSTRAINT "Medida_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alteracao" ADD CONSTRAINT "Alteracao_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visita" ADD CONSTRAINT "Visita_consultorId_fkey" FOREIGN KEY ("consultorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_consultorId_fkey" FOREIGN KEY ("consultorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

