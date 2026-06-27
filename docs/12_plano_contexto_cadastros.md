# Plano — Contexto, Cadastros e Commodities (o que falta para o app "fazer sentido inteiro")

> Documento de DECISÃO, não de código. Nasce de duas observações do dono: (1) o guia "Primeiros
> passos" promete telas que não existem; (2) faltam features "commodity, mas usáveis" que dão
> contexto. Base: pesquisa de mercado ([08](08_pesquisa_mercado.md)) + a régua de marca É/NÃO-É
> ([05](05_branding.md)). **Você risca o que não quer.** A prioridade final sai DEPOIS das entrevistas.

## Parte A — Descompasso guia × produto (o que o guia promete e o código NÃO tem)

O guia é honesto sobre a visão, mas descreve um produto mais completo que o no ar. Verificado no código:

| Passo do guia | Promete | Existe hoje? | Conserto |
|---|---|---|---|
| 1 — Criar oficina + ramo | Escolher template; "ajustar depois" | ✅ criar/ramo · ❌ ajustar template | Tela de config do template (ou aceitar fixo no MVP) |
| 2 — Conferir/ajustar **estações** | Ver e editar as estações do ramo | ⚠️ **semeadas no onboarding, sem tela** | **Cadastro de Estações** (CRUD) |
| 3 — Convidar **equipe** e dar papéis | Convidar usuários, atribuir papel | ❌ **só o admin do cadastro existe** | **Gestão de Equipe** (convidar/papel) |
| 4 — Abrir OS | Registrar peças, fotos, veículo, cliente | ✅ (fotos/peças são campos jsonb não usados na UI) | UI de fotos/peças (opcional) |
| 5 — Link do cliente | Portal por link | ✅ (M6, no ar) | — |
| 6 — Painel na TV | Modo TV + bump | ✅ (no ar) | — |

**Conclusão A:** faltam **3 cadastros de apoio** (Estações, Equipe, e Cliente/Equipamento como entidade) para o app cumprir o próprio guia. Sem eles, o guia mente em 2–3 pontos.

---

## Parte B — Inventário de features dos concorrentes (risque o que não quer)

Legenda: **✅ Temos** · **🟡 Contexto que falta** (o app já pede, e dá sentido) · **⚪ Commodity opcional** (concorrente tem, decide se vale) · **⛔ NÃO-É** (fere a régua de marca: "sistema operacional do chão", não ERP).

### Núcleo / diferencial — já temos
| Feature | Status |
|---|---|
| OS + máquina de estados + as 4 perguntas | ✅ |
| Triagem por prioridade (razão crítica) + travamento + regra da vez | ✅ |
| Painel ao vivo + modo TV + bump + realtime | ✅ |
| Orçamento (peças/mão de obra/terceiro) + gates reais | ✅ |
| Portal do cliente por link (aprovar/recusar) | ✅ |
| **Responsabilização do atraso (de quem é a bola) ao vivo + histórico** | ✅ **(o diferencial)** |

### Contexto que falta (🟡) — o app já pede, fecha o guia
| # | Feature | Por que dá contexto | Concorrente tem? |
|---|---|---|---|
| C1 | **Cadastro de Estações** (ver/editar/ordenar) | Passo 2 do guia; é o mapa do chão | Certtus sim |
| C2 | **Gestão de Equipe** (convidar usuário, papel, ativar/desativar) | Passo 3; RBAC já existe, falta a tela | Todos |
| C3 | **Cadastro de Clientes** (entidade própria + histórico de OS) | Hoje cliente nasce escondido no "abrir OS"; oficina pensa em "meus clientes" | Todos |
| C4 | **Cadastro de Equipamentos/Veículos** (por cliente, com histórico) | "Esse motor já passou aqui?"; reincidência/garantia | Certtus, Tekmetric |
| C5 | **Número sequencial de OS** ("OS-41") | O chão decora número, não hash (ADR-011 já desenhado) | Todos |
| C6 | **Busca/filtro de OS** (por cliente, placa, estado) | Com volume, achar uma OS | Todos |

### Commodity opcional (⚪) — concorrente tem, você decide se vale
| # | Feature | A favor | Contra (régua/risco) |
|---|---|---|---|
| O1 | **Notificação WhatsApp** ao cliente por etapa | Mata ainda mais ligação | M7; depende de parceiro/custo; o portal já reduz ligação |
| O2 | **Agendamento** (data prometida + agenda) | Prazo é central na triagem | Vira "agenda de oficina", pode inchar |
| O3 | **Checklist de recepção** (estado de entrada do equipamento) | Prova do estado na entrada; reduz disputa | Mais um formulário no chão |
| O4 | **Fotos na OS** (campo já existe no schema, sem UI) | Prova visual; recepção e CQ | Upload/armazenamento (custo) |
| O5 | **Laudo/diagnóstico estruturado** (medidas/metrologia) | Específico de retífica; valor técnico | Complexo; vira "ERP de bancada" |
| O6 | **Templates de ramo configuráveis** (estações/gates/gatilhos por tenant) | Escala multi-ramo | M8; só com 2º ramo pedindo |
| O7 | **Garantia** (re-entrada vinculada à OS original) | RN do PRD; recorrência | Modela depois do laudo |
| O8 | **Relatórios de gestão** (produtividade, tempo por etapa) | Gestor adora número | Cuidado: "honesto, não mais um BI" |
| O9 | **PDF do orçamento** (imprimir/enviar) | Cliente quer o papel | Fácil; baixo risco |
| O10 | **Catálogo de peças/serviços** (preços pré-cadastrados) | Acelera montar orçamento | Vira gestão de estoque se crescer |

### NÃO-É (⛔) — fere a marca, fica de fora (a menos que você reverta)
| Feature | Por quê fora |
|---|---|
| Emissão de NF-e / fiscal | "Por integração", nunca core (régua + 01_conception) |
| Financeiro completo (contas a pagar/receber, DRE, fluxo de caixa) | É ERP; o Certtus/Wüst competem aí, não nós |
| Controle de estoque com baixa | Idem; vira o "tudo-em-um pesado" que a marca recusa |
| Pagamento online no portal | Fora do escopo do portal (status + decisão) |
| Consulta SPC/Serasa, CRM de vendas | Não é chão de oficina |

---

## Parte C — Recomendação de prioridade (RICE) — a calibrar com a entrevista

> Reach (uso por ciclo) × Impact × Confidence / Effort. **Provisório — a entrevista pode virar isto.**

| Prioridade | Itens | Racional |
|---|---|---|
| **AGORA (fecha o guia + dá contexto)** | C2 Equipe, C1 Estações, C5 nº de OS | O guia promete; baratos; o app passa a "fazer sentido inteiro" |
| **LOGO** | C3 Clientes, C4 Equipamentos, C6 Busca | Entidades próprias + achar OS; valor cresce com uso |
| **AVALIAR c/ entrevista** | O9 PDF orçamento, O3 checklist, O4 fotos, O2 agendamento | "Quase-essenciais" que a oficina pode pedir alto |
| **ESCALA (gated)** | O1 WhatsApp (M7), O6 templates (M8), O5 laudo, O7 garantia, O8 relatórios, O10 catálogo | Só com validação + 2º piloto pedindo |
| **NUNCA (régua)** | fiscal, financeiro, estoque, pagamento, SPC | Vira o ERP que a marca recusa |

### A pergunta que a entrevista responde (e reordena isto)
- Os cadastros (C1–C4) são "óbvio que precisa" ou ninguém liga? → confirma o AGORA/LOGO.
- Qual commodity (O1–O10) aparece espontaneamente como "isso eu uso todo dia"? → sobe na lista.
- O que o entrevistado diz que **não usaria** mesmo de graça? → some da lista.

## Nota de marca (o equilíbrio que você apontou)
"Não pode ser tudo que o concorrente tem" está certo. O risco do Igni não é faltar feature, é **virar mais um ERP pesado** e perder a alma (simplicidade + honestidade). Regra prática: **todo cadastro novo serve ao relance no painel ou à responsabilização honesta; se não serve, é candidato a ⛔.** Contexto (C1–C6) serve. Fiscal/financeiro/estoque não.
