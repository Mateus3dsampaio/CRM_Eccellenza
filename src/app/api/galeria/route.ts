import { rota } from "@/lib/api";
import { exigirUsuario } from "@/lib/sessao";
import type { FamiliaMidia } from "@/regras/midia";
import { listarGaleria } from "@/servicos/midias";

export const dynamic = "force-dynamic";

// Galeria do vendedor: mídias (imagem, vídeo, PDF) dos leads dele. O admin vê todas (e filtra por vendedor).
export const GET = rota(async (req: Request) => {
  const usuario = await exigirUsuario();
  const p = new URL(req.url).searchParams;
  const familia = p.get("tipo");
  return listarGaleria(usuario, {
    familia: familia === "imagem" || familia === "video" || familia === "documento" ? (familia as FamiliaMidia) : undefined,
    vendedorId: p.get("vendedor") ?? undefined,
    limite: Math.min(Math.max(Number(p.get("limite")) || 60, 1), 200),
    deslocamento: Math.max(Number(p.get("deslocamento")) || 0, 0),
  });
});
