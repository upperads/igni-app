import type { EstadoOS } from "./estado";

/**
 * Status do serviço na voz do CLIENTE — honestidade SIMÉTRICA (a estratégia do dono + voz do mercado).
 * Fatos com carimbo de estado, NUNCA acusação ("a culpa é sua"). A dependência emerge dos fatos: quando
 * depende do cliente, vira CALL-TO-ACTION (aprovar/retirar), não cobrança. Pura, reusável (portal + zap).
 */

export type LadoBola = "cliente" | "oficina";
export type AcaoCliente = "aprovar" | "retirar" | null;

export interface StatusCliente {
  /** Rótulo curto e factual do estágio. */
  rotulo: string;
  /** Uma linha factual do que está acontecendo (sem acusar). */
  detalhe: string;
  /** De que lado a espera está agora (interno; o cliente vê o FATO, não a palavra "culpa"). */
  bola: LadoBola;
  /** Quando depende do cliente, o que ele faz para destravar. */
  acao: AcaoCliente;
}

export function statusCliente(estado: EstadoOS): StatusCliente {
  switch (estado) {
    case "aberta":
      return { rotulo: "Recebido", detalhe: "Recebemos o equipamento, na fila para o diagnóstico.", bola: "oficina", acao: null };
    case "diagnostico":
      return { rotulo: "Em diagnóstico", detalhe: "Avaliando e medindo o que precisa.", bola: "oficina", acao: null };
    case "orcamento":
      return { rotulo: "Montando o orçamento", detalhe: "Preparando o orçamento do serviço.", bola: "oficina", acao: null };
    case "aguardando_aprovacao":
      return { rotulo: "Aguardando sua aprovação", detalhe: "O orçamento está pronto e esperando você aprovar para seguirmos.", bola: "cliente", acao: "aprovar" };
    case "aguardando_peca":
      return { rotulo: "Aguardando peça", detalhe: "Esperando a peça chegar para continuar o serviço.", bola: "oficina", acao: null };
    case "execucao":
      return { rotulo: "Em execução", detalhe: "Seu serviço está sendo feito na oficina.", bola: "oficina", acao: null };
    case "controle_qualidade":
      return { rotulo: "Controle de qualidade", detalhe: "Em teste e conferência final antes de liberar.", bola: "oficina", acao: null };
    case "pronta":
      return { rotulo: "Pronto", detalhe: "Serviço concluído e aprovado. Pode combinar a retirada.", bola: "cliente", acao: "retirar" };
    case "entregue":
      return { rotulo: "Entregue", detalhe: "Serviço entregue. Obrigado!", bola: "oficina", acao: null };
  }
}

/** Monta a mensagem HONESTA de WhatsApp (recepção → cliente). Sem acusação; com o link opcional. */
export function mensagemWhatsapp(args: {
  numeroOs: number;
  equipamento: string;
  status: StatusCliente;
  link?: string;
}): string {
  const abertura = `Olá! Sobre o seu ${args.equipamento} (OS-${args.numeroOs}):`;
  const corpo = args.status.detalhe;
  const cta =
    args.status.acao === "aprovar"
      ? "Você pode aprovar o orçamento pelo link abaixo."
      : args.status.acao === "retirar"
        ? "Quando quiser, é só combinar a retirada."
        : "Avisaremos a cada novidade.";
  const linha = args.link ? `\n\nAcompanhe: ${args.link}` : "";
  return `${abertura} ${corpo} ${cta}${linha}`;
}
