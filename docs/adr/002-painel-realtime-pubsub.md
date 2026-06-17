# ADR-002: Painel de setor em tempo real via pub/sub (push), não polling

## Contexto
As TVs de setor são o herói do produto e precisam refletir mudanças de estado quase
instantaneamente (RNF-PERF-01, alvo < ~2s). Várias telas (TVs, mobiles, painel gestor)
observam o mesmo dado ao mesmo tempo.

## Decisão
Propagar mudanças por um **canal pub/sub** (push): quando a OS muda de estado, o backend
publica o evento e os assinantes (painéis) recebem em tempo real. Implementação via
Postgres LISTEN/NOTIFY + gateway WebSocket, ou serviço gerenciado (Ably/Pusher/Supabase
Realtime).

## Alternativas consideradas
- **Polling** (a tela pergunta de tempos em tempos): simples, mas gera latência e carga
  desnecessária com muitas TVs sempre ligadas. Descartado como padrão.
- **Recarregar a página**: inviável para um painel always-on. Descartado.

## Consequência
Atualização fluida e baixa latência nas TVs; arquitetura preparada para muitos observadores.
Exige um canal realtime confiável e tolerância a reconexão (RNF-DISP-01: o painel mantém o
último estado e reconecta após queda de rede no chão).
