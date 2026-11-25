import type { Canal } from "@/regras/canal";
import { NOME_CANAL } from "@/regras/canal";

/** Marca pequena do canal do contato (tarefa 47). Só o Instagram ganha marca: o WhatsApp é o padrão e não precisa de selo. */
export function IconeInstagram({ className = "size-3.5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" role="img" aria-label="Instagram">
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
    </svg>
  );
}

/** Selo de canal para card, conversa e ficha: só aparece se o contato tem Instagram. */
export function SeloCanal({ canais, className }: { canais: Canal[]; className?: string }) {
  if (!canais.includes("instagram")) return null;
  return (
    <span className={className ?? "inline-flex items-center text-[#c13584]"} title={canais.includes("whatsapp") ? `${NOME_CANAL.whatsapp} e ${NOME_CANAL.instagram}` : NOME_CANAL.instagram}>
      <IconeInstagram />
    </span>
  );
}
