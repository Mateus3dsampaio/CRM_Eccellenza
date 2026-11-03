/** Bolinha com o número de mensagens não lidas, como no WhatsApp (ESP-06). Some quando é zero. */
export function BolinhaNaoLidas({ total }: { total: number }) {
  if (total <= 0) return null;
  const texto = `${total} ${total === 1 ? "mensagem não lida" : "mensagens não lidas"}`;
  return (
    <span
      title={texto}
      className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-sucesso px-1.5 text-xs font-semibold tabular-nums text-sobre-marca"
    >
      <span aria-hidden>{total > 99 ? "99+" : total}</span>
      <span className="sr-only">{texto}</span>
    </span>
  );
}
