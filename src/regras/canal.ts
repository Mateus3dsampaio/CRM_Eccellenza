// Canais de atendimento (tarefa 47): WhatsApp e Instagram.
export type Canal = "whatsapp" | "instagram";

export const NOME_CANAL: Record<Canal, string> = { whatsapp: "WhatsApp", instagram: "Instagram" };

export function canalValido(valor: string | null | undefined): Canal {
  return valor === "instagram" ? "instagram" : "whatsapp";
}

/**
 * Por onde a loja responde. Lead com um só canal responde por ele. Lead com os dois (depois de unir) responde pelo canal da
 * última mensagem do cliente; sem mensagem dele ainda, pelo WhatsApp.
 */
export function canalDeEnvio(lead: { telefone: string | null; igsid: string | null; canal: string }, ultimoCanalDoCliente?: string | null): Canal {
  const temWhatsapp = !!lead.telefone;
  const temInstagram = !!lead.igsid;
  if (temInstagram && !temWhatsapp) return "instagram";
  if (temWhatsapp && !temInstagram) return "whatsapp";
  if (temInstagram && temWhatsapp) return ultimoCanalDoCliente === "instagram" ? "instagram" : "whatsapp";
  return canalValido(lead.canal);
}

/** O lead tem os dois canais ligados (foi unido)? Aí a janela de 24h de cada canal conta separada. */
export function temOsDoisCanais(lead: { telefone: string | null; igsid: string | null }): boolean {
  return !!lead.telefone && !!lead.igsid;
}

// Texto PROVISÓRIO (o Mateus aprova): o Instagram não tem modelo de mensagem aprovado como o WhatsApp.
export const SEM_MODELO_NO_INSTAGRAM = "O Instagram não tem modelo de mensagem: só dá para responder dentro das 24h depois da última mensagem do cliente.";
export const SEM_ARQUIVO_NO_INSTAGRAM = "Por enquanto o CRM não envia imagem, vídeo ou arquivo pelo Instagram. Mande só texto, ou peça o WhatsApp do cliente.";
