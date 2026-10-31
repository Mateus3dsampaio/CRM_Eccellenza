// Fica fora de tema.tsx (componente de cliente) para o layout do servidor poder ler o texto.
/** Roda antes da primeira pintura (no <head>) para a tela não piscar clara. */
export const SCRIPT_TEMA = `try{var t=localStorage.getItem("tema-crm");if(!t)t=matchMedia("(prefers-color-scheme: dark)").matches?"escuro":"claro";document.documentElement.dataset.tema=t}catch(e){}`;
