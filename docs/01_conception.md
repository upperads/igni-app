# Concepção — PRONTO (codinome)

> Fase 1 do ciclo. Define o **porquê** (macro) antes de qualquer especificação técnica.
> Premissa que governa todo o projeto: o detalhe técnico só existe para sustentar o
> objetivo de negócio. Funcionalidade que não serve ao Business Case não entra.

---

## Business Case

### Problema
Oficinas sob encomenda — retíficas de motores (pesada/agro e leve) e centros automotivos —
operam sem visibilidade operacional:

- **Serviço órfão**: ninguém sabe, em sistema, onde o serviço está, por que parou, o que
  falta e pra onde vai.
- **Priorização no olho**: a ordem de execução é decidida informalmente, gerando fricção.
- **Gargalo é a espera, não o trabalho**: o que atrasa é aprovação de orçamento e peça —
  e a queixa nº1 do cliente final é justamente o atraso, hoje respondido por ligações.
- **Ferramentas inadequadas**: as opções existentes ou são genéricas (não têm a forma da
  oficina) ou são pesadas e legadas. A reclamação nº1 do mercado é "sistema complicado
  que a equipe não usa e que não resolve o problema real".

### Proposta de valor
O **sistema operacional da oficina sob encomenda**: um painel ao vivo na parede de cada
setor (modelo pronto-atendimento / telão de cozinha) + triagem calculada + status do
serviço para o cliente **com responsabilização**. É superior ao status quo porque:

1. **Simplicidade visual que a equipe de fato usa** — feito para um glance na TV, não para
   um operador de ERP. (Ataca a dor nº1 do mercado.)
2. **Gestão de atraso com culpa explícita** — o cliente vê se a bola está com ele
   (aprovação/peça dele) ou com a oficina. Mata a queixa nº1 e as ligações de status.
3. **Cérebro de chão sob encomenda entregue de forma enxuta** — prioridade calculada
   (razão crítica), travamento como estado separado, liberação por capacidade.
4. **Híbrido por templates opinativos** — retífica pesada/agro, retífica leve e centro
   automotivo sobre um único motor de workflow. Escala sem virar genérico.

### Viabilidade
- **Técnica**: stack web moderna, multi-tenant, cloud, real-time, amigável a TV e mobile.
  Complexidade média; o núcleo é o motor de estados + o painel em tempo real. Fiscal e
  pagamento entram via integração/parceiro, reduzindo escopo. Build acelerado por IA.
- **Econômica**: base de ~2.840 retíficas + milhares de centros automotivos no Brasil;
  receita recorrente (SaaS) com expansão por módulos e por painel. CAC mitigável por
  comunidade/associações do setor. Dogficar na própria retífica reduz custo de validação.

### Riscos (mínimo 3, com mitigação)
1. **Inércia do incumbente + baixa maturidade digital** (retíficas com Certtus há 10+ anos)
   → mirar nichos mal servidos (pesado/agro) e oficinas novas/insatisfeitas; UX
   dead-simple; usar a própria oficina como caso de prova.
2. **Trair a própria proposta virando ERP pesado** → regra inegociável do "teste do
   mecânico de mão suja"; fiscal/financeiro completos só por integração; lançar templates
   opinativos, nunca tela configurável crua.
3. **Construir demais antes de validar / fundador não-software** → MVP enxuto + 2–3 pilotos
   pagantes antes de escalar; build assistido por IA; modo de aprovação por fase.
4. **Dependência de hardware no chão** (TV, rede, bump bar) → suportar dispositivos baratos
   (tablet/Android), operação resiliente a queda de rede, cabeamento recomendado.

### Critério de sucesso
Em 12 meses (metas a calibrar):
- **≥ 15–25 oficinas pagantes ativas** com **churn mensal < 3%**.
- Nos clientes-piloto: **queda ≥ 30%** no percentual de OS entregues com atraso e
  **queda ≥ 50%** nas ligações de "cadê meu serviço".
- Pelo menos **2 dos 3 templates** (retífica + centro automotivo) validados em produção.

---

## Project Model Canvas (visão de 30 mil pés)

| Bloco | Conteúdo |
|-------|----------|
| **Justificativas** | Mercado pulverizado e de baixa maturidade digital; incumbente forte porém legado e complexo; tendência confirmada de painéis em tempo real e status ao cliente. Espaço vazio: visibilidade honesta com responsabilização, enxuta. |
| **Objetivo SMART** | Lançar em 6 meses um MVP multi-tenant com os templates retífica pesada/agro e retífica leve, validado em ≥ 3 oficinas pagantes, entregando painel de setor + triagem calculada + status do cliente. |
| **Benefícios** | Menos atraso, fim do serviço órfão, equipe coordenada, cliente informado sem ligar, decisão de prioridade com critério, base para escalar receita recorrente. |
| **Produto** | SaaS web multi-tenant: OS digital, máquina de estados com gates, painel de TV por setor (estilo KDS), triagem calculada, travamento como estado, status do cliente com responsabilização, orçamento + aprovação por link. |
| **Requisitos (alto nível)** | Real-time; multi-tenant isolado; templates por ramo; mobile/TV; integração de WhatsApp; preparado para integração fiscal/pagamento. |
| **Stakeholders** | Donos de oficina (comprador), recepção/orçamentista, retificadores/mecânicos (usuários de chão), cliente final (consome status), distribuidoras de peças e associações (canal). |
| **Equipe** | Fundadores (Daniel + sócio: domínio + operação/venda); desenvolvimento assistido por IA; futura contratação técnica conforme escala. |
| **Premissas** | A oficina tem ao menos uma TV/tablet por setor; cliente final usa WhatsApp; o diferencial é processo+simplicidade, não volume de função. |
| **Grupo de entregas** | Onda 1 (MVP): núcleo de visibilidade. Onda 2: financeiro por OS, estoque/compras, garantia. Onda 3: fiscal (parceiro), portal do cliente, base técnica de motores, agendamento por capacidade, multi-filial. |
| **Restrições** | Não construir fiscal do zero; não virar ERP; não lançar tela configurável crua; respeitar baixa maturidade digital do usuário. |
| **Riscos** | Ver Business Case (inércia do incumbente, scope creep, validação tardia, hardware). |
| **Linha do tempo** | Inception (4 fases de doc) → MVP dogfood na própria oficina → 2–3 pilotos pagantes → produtização e escala. |
| **Custos** | Desenvolvimento (acelerado por IA), infra cloud, integrações de terceiros (fiscal/pagamento/WhatsApp), suporte/onboarding. Receita: assinatura por oficina + por painel + take-rate futuro. |

---

## Resumo dos entregáveis da Fase 1
- Business Case com problema, proposta de valor, viabilidade técnica/econômica, 4 riscos
  mitigados e critério de sucesso mensurável.
- Project Model Canvas de 13 blocos em uma página.

**Próximo gate:** aprovar para a Fase 2 (Definição: PRD + SRS), onde entram as personas e
jornadas (devdead-front) e os requisitos não-funcionais de segurança (devdead-sec).
