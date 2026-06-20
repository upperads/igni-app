# ADR-009: Triagem (razão crítica + gatilhos) e Travamento (regra da vez)

## Contexto
O M3 dá à fila uma ordem honesta por impacto (RN-02) e separa **travamento** de **prioridade**
(RN-03). É o que transforma a lista de OS no board de controle — o diferencial do produto. Como o
M2, a lógica precisa nascer **pura e testável** (CLAUDE.md / ADR-003), antes de schema/UI. Pesos da
razão crítica e SLAs são **configuráveis** (CLAUDE.md / RF-03), então a função recebe a config
injetada — nada de número mágico cravado no cálculo.

## Decisão

### Razão crítica (US-07)
Heurística clássica de sequenciamento (*critical ratio*): `cr = dias_restantes ÷ trabalho_restante`.
- **dias_restantes** = `prazo_prometido − hoje` (em dias UTC; pode ser **negativo** = atrasado).
  Sem prazo, não há pressão de prazo: a urgência base é neutra e só os gatilhos pesam.
- **trabalho_restante** = nº de etapas restantes até `entregue` na máquina de estados (ADR-008).
  É o proxy **honesto e disponível** hoje (não rastreamos horas); quando houver estimativa real de
  esforço, troca-se só esta função, sem mexer no resto.

`cr` baixo (pouco tempo, muito trabalho) = mais urgente; `cr` alto = folga. Como "maior = mais
urgente" é mais intuitivo para ordenar e classificar, derivamos uma **urgência** (o score) a partir
do `cr` e somamos os pesos dos gatilhos ativos.

### Gatilhos do ramo (RN-02), aditivos e com peso configurável
- **frota parada** — cliente do tipo `frota` (veículo de frota parado custa caro ao cliente).
- **máquina única do produtor** — `equipamento.maquina_unica` e cliente `produtor`.
- **retrabalho de garantia** — houve CQ reprovado (evento `controle_qualidade → execucao`),
  derivável da linha do tempo do M2.

### Prioridade (bucket) e cor
A urgência cai em um **bucket** `prioridade ∈ {critica, alta, normal, baixa}` por **thresholds
configuráveis** (os SLAs). A cor da triagem deriva do bucket — e, como sempre, **cor + rótulo +
posição**, nunca cor sozinha (03b / WCAG).

### Override humano, registrado (US-07)
`prioridade_override` (bucket, nulável) **fixa** a prioridade exibida, vencendo o cálculo. Todo
override é **registrado** em `ajuste_prioridade` (quem / quando / de → para / motivo). O score
calculado continua disponível para transparência ("o sistema diria X; fulano fixou Y").

`prioridade` (coluna) guarda o **bucket efetivo** = `override ?? bucket_calculado`;
`prioridade_score` guarda a urgência calculada. Recalcula-se quando muda uma entrada do cálculo
(prazo, estado/trabalho restante, gatilhos).

### Travamento, dimensão separada (US-08 / RN-03)
`travado` (bool) + `travamento_motivo` + `travamento_responsabilidade ∈ {empresa, cliente}`. **Não**
é estado da máquina (ADR-008) nem altera o score de urgência — urgência é o "real", a vez é a "fila".

### Regra da vez (RN-03)
A ordenação respeita a prioridade, mas o travamento a ajusta:
- travado **por culpa da empresa** → **mantém a vez** (a oficina é que está devendo).
- travado **por culpa do cliente** → **pode perder a vez** (rebaixa na fila; não é justo furar quem
  está andando por causa de pendência do cliente).

Modelado como **chave de ordenação** pura `ordenarFila(oss, config)`: ordena por bucket de
prioridade, com penalidade de posição para "travado por cliente", desempatando por score e, por fim,
pela data de entrada (FIFO). O score em si não muda — só a vez.

## Alternativas consideradas
- **Score calculado on-the-fly só na leitura** (não persistir): simples, mas o M4 (painel/Realtime)
  precisa empurrar a mudança e a fila precisa ordenar no banco. Persistir `prioridade`/`score`
  (recalculados nos pontos de mudança) habilita ambos. Mantido o persistir, como no ERD.
- **Travamento como estado da máquina** (um estado "travado"): já descartado no ADR-008 — polui a
  máquina e mistura duas dimensões. Travamento é flag + responsabilidade.
- **Regra da vez mexendo no score**: rebaixaria a urgência "real" da OS, mentindo no número.
  Preferimos ajustar **a ordenação**, preservando o score honesto.
- **Pesos/thresholds cravados no código**: viola "configurável" (CLAUDE.md). A função recebe
  `ConfigTriagem`; o default mora em código e o override por tenant/template entra no M8.

## Consequência
Nasce `src/domain/os/triagem.ts` como funções puras (`razaoCritica`, `trabalhoRestante`,
`gatilhosAtivos`, `classificarPrioridade`, `ordenarFila`) com testes de unidade cobrindo o cálculo,
cada gatilho, os buckets e a regra da vez nas duas responsabilidades (Definition of Done de
US-07/US-08). O schema ganha `prioridade`, `prioridade_score`, `prioridade_override`, `travado`,
`travamento_motivo`, `travamento_responsabilidade` na `os`, mais a tabela `ajuste_prioridade`
(com `tenant_id` + RLS, como toda tabela nova). Os casos de uso (recalcular, ajustar/override,
travar/destravar) e a UI da fila consomem esta lógica nas fatias seguintes. O painel em modo TV e o
canal Realtime são o **M4**, não aqui.
