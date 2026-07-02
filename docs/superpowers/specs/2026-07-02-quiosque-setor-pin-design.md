# Design — Quiosque de Setor + PIN (P-0)

> Spec de design validado com o dono (brainstorming, 02/07/2026). Fecha o P-0 do backlog de produto
> ([docs/15](../../15_backlog_produto.md)): a equipe do chão dá o bump com **atrito mínimo, sem perder o
> "quem"**. Ataca o risco nº1 do Igni — a adoção do chão. Schema-first, como todo o projeto.

## Problema

Hoje o chão avança OS pela rota `/chao`, que exige **login individual por pessoa** (e-mail/senha,
sessão em cookie). A pesquisa de mercado ([voz_do_mercado §H1](../../voz_do_mercado_igni.md)) aponta que
o atrito no chão é o que **mata ou salva** o produto: *"a equipe de chão não abre o sistema"*. E o dono
levantou o furo conceitual: *"como a equipe dá o bump numa TV? Precisa de um PC por box?"* — não precisa,
mas o produto nunca ofereceu o modelo certo (tablet-quiosque por setor).

## Solução: duas credenciais, cada uma no seu peso

- **TABLET do box = logado NO SETOR** por um **token forte** (256 bits, hash guardado — mesmo padrão do
  portal do cliente). É a porta trancada. Só o admin gera; escopo mínimo; longo-vivo (fica no tablet);
  revogável pelo admin.
- **PIN de 4 dígitos individual = "quem tocou"**. Credencial **leve**: só CARIMBA a autoria no evento.
  PIN errado **não destranca nada** (a porta é o token do tablet), só rejeita/erra o carimbo. Isso dá a
  rastreabilidade que o dono quer (o João não é confundido com o Pedro) **sem** o risco de força bruta de
  4 dígitos — a segurança forte mora no token, não no PIN.

O quiosque é um **primo do portal** (`/portal/[token]`, já auditado e em produção): acesso por token, sem
sessão de usuário, resolução em 2 etapas, isolado por tenant via `withTenant`.

## Modelagem (migration nova, aditiva/segura em prod)

**1. `usuario.pin_hash text` (nullable)** — hash do PIN (nunca o cru; `sha256`, como o token do portal).
Nulo para quem não é do chão. O PIN identifica a pessoa **dentro do tenant** (dois tenants podem ter o
PIN "1234"; a busca é sempre escopada por tenant + `papel='producao'`).

**2. Tabela `quiosque_setor`:**
| Coluna | Tipo | Papel |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK tenant | RLS por tenant |
| `estacao_id` | uuid FK estacao | qual setor este quiosque serve |
| `token_hash` | text UNIQUE | o token forte do tablet (só o hash) |
| `codigo_curto` | text UNIQUE | atalho de backup, ex. "BLOCO-4K2P": prefixo legível do setor + 4 chars aleatórios do alfabeto seguro (sem 0/O/1/I). Resolve pro token do MESMO registro. UNIQUE global (raro colidir; regenera se colidir) |
| `criado_por` | uuid FK usuario | qual admin ligou |
| `revogado_em` | timestamptz null | null = ativo; preenchido = desligado (revogação) |
| `ultimo_uso_em` | timestamptz null | pra o admin ver "usado há 3min" |
| `created_at` | timestamptz | |

RLS por tenant na **mesma migration** (regra de ouro #7). O token do quiosque é **longo-vivo** (sem
expiração automática — um tablet de chão não pode morrer sozinho no expediente); o controle é a
**revogação manual** do admin.

## Segurança — resolução em 2 etapas (o coração)

O quiosque não tem sessão de cookie. Resolve tudo pelo token, como o portal:

**Etapa 1 — resolver o token (leitura privilegiada MÍNIMA):**
```
tablet manda token → sha256 → busca quiosque_setor por token_hash
  ├── não achou / revogado_em preenchido → "Quiosque desligado. Peça um novo ao escritório."
  └── achou e ativo → { tenantId, estacaoId }   (tenant vem do REGISTRO, nunca do tablet)
```

**Etapa 2 — daí em diante, tudo via `withTenant(tenantId)`** (RLS de volta), escopado ao setor:
```
listar OS → withTenant + WHERE estacao_id = <a do quiosque>   (só o setor dele)
bump      → withTenant + PIN→porUsuarioId + origem='chao'
```

**Fluxo do bump com PIN:**
```
1. produtivo toca "PRONTO →" numa OS do setor
2. teclado de PIN (4 dígitos, alvo grande, luva)
3. servidor: sha256(PIN) → busca usuario no tenant com aquele pin_hash E papel='producao'
   ├── não achou → "PIN não confere. Tente de novo."   (NÃO destranca — só carimbo)
   └── achou → executarTransicao com porUsuarioId = esse usuário, origem='chao'
4. TV e painel atualizam por realtime (já existe)
```

**Estados de erro (todos fecham a porta):**
| Situação | Resultado |
|---|---|
| Token inválido/revogado | Tela "desligado"; nada acontece |
| Token de outro tenant | Impossível — o tenant vem do registro do token |
| PIN errado | "PIN não confere"; bump não ocorre; nada vaza |
| PIN de produtivo de outro tenant | Não acha (busca escopada por tenant) |
| Ação fora do escopo (abrir OS, ver preço) | Não existe rota pra isso no quiosque |

**Anti-abuso:** PIN é carimbo (não destranca), então força bruta não abre porta. Ainda assim, **rate-limit
leve por quiosque** (reusa `dentroDoLimite` de `infra/rate-limit.ts`) contra spam de tentativas.

## Escopo do quiosque (mínimo, porque o tablet fica exposto)

**PODE (o trabalho físico do chão):**
- Avançar OS do próprio setor (o bump).
- Ver o **detalhe básico** da OS (equipamento, o que falta, pra onde vai).
- Travar/destravar (sinalizar "faltou peça", "aguardando algo").

**NÃO PODE (fica no admin/recepção):**
- Preço, orçamento, financeiro.
- Dados de cliente/comercial.
- Abrir OS nova, ver outros setores.

Mesma filosofia da regra de ouro do Igni ("produção não edita orçamento"), estendida ao quiosque: o chão
mexe no fluxo físico; dinheiro e cliente são do escritório. Se o tablet vazar, o estrago é mínimo.

## Telas

**PC — gerenciar quiosques (na tela `/config/estacoes` que já existe):** cada setor mostra se tem quiosque
ativo (com "usado há Xmin"); botões "Ligar tablet" (→ modal com **QR grande + código curto** de backup) e
"Revogar" (com confirmação, mata o token na hora).

**PC — PIN na tela `/config/equipe`:** ao convidar/editar um membro de **produção**, campo "PIN (4 dígitos)"
que o admin define/reseta. Só aparece para papel produção.

**Tablet — `/quiosque/[token]` (rota nova, sem AppShell, irmã de `/portal/[token]`):** cabeçalho fixo com o
nome do setor (sem menu, sem sair), cards grandes das OS **só do setor**, botão "PRONTO →" que abre o
teclado de PIN de **4 dígitos**. Depois do PIN certo: "Feito ✓" e a TV atualiza. O `/chao` com login
continua existindo; o quiosque é o modo sem-senha.

**Como o código curto entra (importante pra não virar buraco):** o QR já embute a URL com o **token forte**
(o tablet abre direto em `/quiosque/[token]`). O **código curto** é só pro caso do QR não rolar: o tablet
abre uma tela "digite o código", manda o código ao servidor, que **troca o código pelo token forte** e
redireciona pra `/quiosque/[token]`. Ou seja, o código curto é usado **uma vez, na hora de ligar** — a
credencial que fica no tablet é sempre o token forte, nunca o código curto (que é curto e adivinhável).
Detalhe de robustez: rate-limit na troca do código curto (evita adivinhação do "BLOCO-XXXX").

## Fatiamento (schema-first)

1. **Schema + migration**: `usuario.pin_hash` + `quiosque_setor` + RLS + teste de isolamento.
2. **Domínio/aplicação**: gerar token de quiosque, resolver token (2 etapas), resolver PIN→usuario,
   bump-por-quiosque (reusa `executarTransicao` com `porUsuarioId` do PIN).
3. **Admin**: gerar/revogar quiosque em `/config/estacoes`; definir PIN em `/config/equipe`.
4. **Quiosque**: rota `/quiosque/[token]` (lista do setor + bump com PIN + detalhe básico + travar).
5. **Testes**: isolamento multi-tenant (quiosque/PIN de A nunca tocam B), PIN carimba o usuário certo,
   revogação mata o acesso, escopo do setor. Pipeline (typecheck/lint/build) + CI verde + deploy + smoke.

## Fora desta leva (outras fatias / backlog)
- Explicar o modelo de hardware (TV+tablet+PC) no onboarding — fatia separada do P-0.
- Controle remoto de qual setor a TV mostra — **P-3**.
- Reforma de papéis/setores (Produção/Financeiro/Compras) — **P-1**.
- Membro escolher o próprio PIN — o dono preferiu admin-define; evolução futura.

## Decisões registradas (com quem decidiu)
- PIN = **carimbo individual** (não credencial de acesso): autoria sem risco de brute-force. **Dono.**
- Ligar tablet por **QR + código curto** de backup. **Dono.**
- Escopo do quiosque: **avançar + detalhe básico + travar/destravar**; preço/orçamento/financeiro só no
  admin. **Dono.**
- **Admin define/reseta o PIN** na tela de Equipe. **Dono.**
- Revogação **manual** na tela de Estações; token longo-vivo, sem expiração automática. **Dono.**
- PIN de **4 dígitos**. **Dono.**
