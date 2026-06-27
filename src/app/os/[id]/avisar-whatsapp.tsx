"use client";

import type { EstadoOS } from "@/domain/os/estado";
import { mensagemWhatsapp, statusCliente } from "@/domain/os/status-cliente";

/** Só dígitos (formato do wa.me). Aceita 11 dígitos (DDD+celular) e antepõe 55 (BR) se faltar. */
function paraWa(numero: string): string | null {
  const d = numero.replace(/\D/g, "");
  if (d.length < 10) {
    return null;
  }
  return d.startsWith("55") ? d : `55${d}`;
}

/**
 * Avisar o cliente no WhatsApp (Fatia 2): a recepção dispara, com 1 clique, a mensagem HONESTA do
 * status no zap do cliente (onde ele já está). Zero integração paga — link nativo wa.me.
 */
export function AvisarWhatsapp({
  numeroOs,
  equipamento,
  estado,
  whatsapp,
}: {
  numeroOs: number;
  equipamento: string;
  estado: EstadoOS;
  whatsapp: string | null;
}) {
  const wa = whatsapp ? paraWa(whatsapp) : null;
  const texto = mensagemWhatsapp({ numeroOs, equipamento, status: statusCliente(estado) });
  const href = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(texto)}`
    : `https://wa.me/?text=${encodeURIComponent(texto)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-sinal-verde/50 px-3 font-body text-sm font-medium text-sinal-verde transition-colors hover:bg-sinal-verde/10"
    >
      <span aria-hidden>↗</span>
      Avisar no WhatsApp
      {!wa ? <span className="font-mono text-xs text-aco-400">(sem número)</span> : null}
    </a>
  );
}
