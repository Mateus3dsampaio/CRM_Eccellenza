import { rota } from "@/lib/api";
import { db } from "@/lib/db";
import { ErroHttp, exigirUsuario } from "@/lib/sessao";
import { marcarMudanca } from "@/lib/versao";
import { LAYOUT_PADRAO_FICHA, layoutValido, limparLayout } from "@/regras/layout-ficha";

export const dynamic = "force-dynamic";
const CHAVE = "layout_ficha";

// Todos leem o layout padrão; só o admin grava ou restaura.
export const GET = rota(async () => {
  await exigirUsuario();
  const salvo = await db.configuracao.findUnique({ where: { chave: CHAVE } });
  if (salvo) {
    try {
      const layout: unknown = JSON.parse(salvo.valor);
      if (layoutValido(layout)) return { layout, personalizado: true };
    } catch {
      // Valor estragado: cai no padrão.
    }
  }
  return { layout: LAYOUT_PADRAO_FICHA, personalizado: false };
});

export const PUT = rota(async (req: Request) => {
  await exigirUsuario("configurar");
  const corpo: unknown = await req.json();
  const layout = (corpo as { layout?: unknown })?.layout;
  if (!layoutValido(layout)) throw new ErroHttp(400, "Layout inválido.");
  const valor = JSON.stringify(limparLayout(layout));
  await db.configuracao.upsert({ where: { chave: CHAVE }, create: { chave: CHAVE, valor }, update: { valor } });
  await marcarMudanca();
  return { ok: true };
});

// Volta ao layout original do sistema.
export const DELETE = rota(async () => {
  await exigirUsuario("configurar");
  await db.configuracao.deleteMany({ where: { chave: CHAVE } });
  await marcarMudanca();
  return { ok: true };
});
