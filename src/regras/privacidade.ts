// Política de privacidade pública (página /privacidade), exigida pela Meta para o app do WhatsApp e pela LGPD.
// PROVISÓRIO: texto PROPOSTO pelo Claude, NÃO é parecer jurídico. O Mateus aprova (de preferência com quem cuida da parte
// jurídica) antes de valer. Razão social, CNPJ, contato e prazos vieram do Mateus (04/11/2026); base legal ficou de fora por decisão dele.
// Para tirar o aviso de "rascunho" da página: variável PRIVACIDADE_APROVADA=1. O e-mail de contato vem de PRIVACIDADE_CONTATO.

export interface SecaoPrivacidade {
  titulo: string;
  paragrafos: string[];
}

// E-mail e telefone da loja informados pelo Mateus (04/11/2026). A variável PRIVACIDADE_CONTATO, se existir, vale mais (ex.: para incluir o telefone da loja).
export const CONTATO_PADRAO = "italinea.eccellenza@hotmail.com ou telefone/WhatsApp (88) 98213-5125";

export function secoesPrivacidade(contato: string | undefined): SecaoPrivacidade[] {
  const canal = contato?.trim() || CONTATO_PADRAO;
  return [
    {
      titulo: "Quem somos",
      paragrafos: ["A Eccellenza é uma loja de móveis planejados Italínea em Juazeiro do Norte, Ceará. A empresa responsável é a Amj Moveis Planejados LTDA, CNPJ 44.584.819/0001-19. Esta página explica como tratamos os dados de quem conversa conosco pelo WhatsApp."],
    },
    {
      titulo: "Quais dados tratamos",
      paragrafos: [
        "Número de telefone e nome do seu perfil no WhatsApp; as mensagens, fotos, vídeos, documentos e arquivos (PDF, Word, Excel, DWG, ZIP e outros) e plantas que você nos envia; e o que você nos conta sobre o seu projeto (ambientes, medidas, cidade, prazo e faixa de investimento).",
        "Se você mandar um áudio, ele é transformado em texto automaticamente. O áudio em si não fica guardado no nosso sistema, só o texto.",
      ],
    },
    {
      titulo: "Para que usamos",
      paragrafos: [
        "Atender você, entender o seu projeto, preparar orçamento, agendar visita ou apresentação e acompanhar o atendimento. Podemos mandar uma mensagem de retomada se a conversa parar.",
      ],
    },
    {
      titulo: "Atendimento com inteligência artificial",
      paragrafos: ["Parte do atendimento inicial é feita por um assistente de inteligência artificial da loja, que segue instruções da Eccellenza. Um consultor humano pode assumir a conversa a qualquer momento."],
    },
    {
      titulo: "Com quem compartilhamos",
      paragrafos: [
        "Usamos empresas que prestam serviço para a loja e que recebem os dados necessários para isso: Meta (WhatsApp, onde a conversa acontece), Anthropic ou OpenAI (inteligência artificial do atendimento: as mensagens da conversa são enviadas à empresa que a loja estiver usando no momento) e OpenAI (transcrição de áudios) e Railway (hospedagem do sistema). Algumas dessas empresas ficam fora do Brasil. Não vendemos seus dados.",
      ],
    },
    {
      titulo: "Por quanto tempo guardamos",
      paragrafos: [
        "Enquanto durar o atendimento, guardamos a conversa e os dados do seu projeto. Se o projeto não for fechado, a conversa é arquivada e apagada depois de 30 dias. Se o projeto for fechado, guardamos os dados por até 180 dias. Fotos, vídeos e documentos são apagados automaticamente depois de 180 dias.",
      ],
    },
    {
      titulo: "Seus direitos",
      paragrafos: [
        "Você pode pedir para saber quais dados temos sobre você, corrigi-los ou apagá-los. Para parar de receber mensagens automáticas, responda PARAR em qualquer conversa. Para os demais pedidos, fale com a gente: " + canal + ".",
      ],
    },
  ];
}
