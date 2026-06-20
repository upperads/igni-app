/**
 * Realtime do painel (ADR-010): publica um "ping" no tópico do tenant quando uma OS muda. O sinal
 * viaja; os dados não — o cliente refaz a leitura pela RLS. Best-effort: se falhar, a mutação segue
 * (o painel atualiza ao navegar). Envio pelo endpoint HTTP de broadcast com a service_role key.
 */
export function topicoPainel(tenantId: string): string {
  return `painel:${tenantId}`;
}

export async function notificarPainel(tenantId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return;
  }
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [{ topic: topicoPainel(tenantId), event: "mudou", payload: {} }],
      }),
    });
  } catch {
    // best-effort: o painel ainda atualiza ao navegar/refazer (RNF-DISP-01).
  }
}
