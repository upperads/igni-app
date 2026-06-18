# Execução — PRONTO (codinome)

> Fase 4. Backlog pronto para codar: User Stories com **Critérios de Aceite (Definition of
> Done)** incluindo **teste**. Organizado pelos módulos da EAP (Fase 3). Escopo: MVP (onda 1).
> Novas stories seguem o mesmo padrão no ciclo leve por feature.

---

## Épico M1 — Tenancy & Auth

### US-01: Como dono, quero criar a conta da minha oficina e escolher o ramo, para começar com o fluxo certo.
- [ ] Cria tenant + usuário admin; escolhe template (retífica pesada/agro, leve, centro automotivo) que pré-carrega estações/gates/gatilhos.
- [ ] Dados isolados por tenant (RLS aplicada).
- [ ] [erro] email duplicado tratado com mensagem clara.
- [ ] [teste] criação de tenant **e teste de isolamento**: tenant A não acessa dado de B.

### US-02: Como admin, quero login seguro com 2FA, para proteger o acesso administrativo.
- [ ] Login com sessão segura; **2FA obrigatório para papel admin**.
- [ ] Bloqueio após N tentativas (**configurável**) com mensagem; recuperação de conta segura.
- [ ] Senha com hash forte; feedback de força de senha em tempo real (UX).
- [ ] [teste] fluxo de login + lockout por threshold.

### US-03: Como gestor, quero papéis de acesso (gestor, recepção, produção), para cada um ver/fazer só o que lhe cabe.
- [ ] RBAC aplicado; produção não edita orçamento.
- [ ] [permissão negada] campos viram read-only/ocultos conforme o papel.
- [ ] [teste] autorização por papel cobre os caminhos de acesso.

---

## Épico M2 — OS & Máquina de Estados

### US-04: Como recepção, quero abrir uma OS (modalidade A/B/C, peças, fotos, veículo, cliente), para iniciar o processo rastreável.
- [ ] Abre OS com os campos; validação inline (prevenção de erro).
- [ ] Gera link do cliente com **token não adivinhável + expiração** (escopo só daquela OS).
- [ ] [vazio] OS sem laudo/orçamento mostra "ainda não" com CTA.
- [ ] Placa/chassi tratados como dado pessoal (LGPD) — base/retenção definidas.
- [ ] [teste] criação de OS + geração de token.

### US-05: Como sistema, quero mover a OS por uma máquina de estados com 3 gates, para impedir transição inválida.
- [ ] Estados na ordem definida; **não desmonta sem OS aberta**, **não usina sem orçamento aprovado**, **não entrega sem CQ**.
- [ ] Cada transição grava EVENTO (de/para/quem/quando).
- [ ] CQ reprovado volta a execução; orçamento recusado volta a diagnóstico.
- [ ] [erro] transição barrada explica o que falta.
- [ ] [teste] unidade cobrindo **todas** as transições e os bloqueios de gate.

### US-06: Como qualquer usuário, quero ver as 4 perguntas (onde/por quê/o que falta/pra onde) em qualquer OS, para nunca ter motor órfão.
- [ ] As 4 derivadas e exibidas em todo estado/travamento.
- [ ] [teste] derivação correta em cada combinação de estado + travamento.

---

## Épico M3 — Triagem & Travamento

### US-07: Como sistema, quero calcular a prioridade pela razão crítica + gatilhos do ramo, para ordenar a fila por impacto.
- [ ] Score = f(prazo, trabalho restante, gatilhos: frota parada / máquina única / garantia); cor derivada do score.
- [ ] Override humano registrado (quem/quando); pesos e SLAs **configuráveis**.
- [ ] [teste] cálculo do score + registro do override.

### US-08: Como recepção, quero travar uma OS com motivo e responsabilidade (empresa/cliente), para aplicar a regra da vez.
- [ ] Travamento é dimensão **separada** da prioridade; selo visível.
- [ ] Culpa do cliente pode rebaixar a vez; culpa da empresa mantém.
- [ ] [teste] regra da vez conforme a responsabilidade.

---

## Épico M4 — Painel & Realtime

### US-09: Como equipe de setor, quero o painel da minha estação em modo TV com cor por tempo, para ver tudo de relance.
- [ ] Board por estação; espinha de status + cronômetro branco→âmbar→vermelho; trilho de risco acende com crítico/atraso.
- [ ] Triagem por **cor + rótulo + posição** (nunca só cor); read-only no modo TV.
- [ ] Os **6 estados** tratados (sucesso / erro-reconexão / vazio / loading / permissão / overflow).
- [ ] [teste] render do board + estados principais.

### US-10: Como operador, quero avançar a etapa por "bump", para mover a OS com a mão suja.
- [ ] Alvo de toque grande (≥ mínimo WCAG, folgado); bump propaga em **< 2s** via realtime.
- [ ] Recall (desfazer) disponível; bump barrado por gate sacode + mostra o motivo.
- [ ] [teste] bump + propagação realtime + recall.

### US-11: Como gestor, quero KPIs (na casa, parada crítica, travadas, atraso) com a manchete no atraso, para agir no que importa.
- [ ] KPIs calculados; **atraso separa a culpa** (nossa / cliente / peça).
- [ ] [teste] cálculo dos KPIs e da separação de culpa.

---

## Épico M5 — Orçamento & Aprovação

### US-12: Como orçamentista, quero montar o orçamento (peças + mão de obra) e enviar por link, para o cliente aprovar.
- [ ] Itens (peça / mão de obra / terceiro com %); status (rascunho/enviado/aprovado/recusado).
- [ ] Envia link; o gate de execução respeita a aprovação.
- [ ] [overflow] muitos itens rolam; descrições truncam.
- [ ] [teste] montagem + envio + **bloqueio de gate sem aprovação**.

---

## Épico M6 — Portal do Cliente

### US-13: Como cliente, quero ver o estágio do meu serviço e de quem é a bola, para parar de ligar.
- [ ] Stepper do estágio; destaque de responsabilização (âmbar quando a pendência é minha); tema claro.
- [ ] Token de escopo mínimo + expiração.
- [ ] [erro] link expirado/inválido tratado.
- [ ] [teste] acesso por token + isolamento (token só abre a própria OS).

### US-14: Como cliente, quero aprovar/recusar o orçamento pelo link, para destravar ou renegociar sem login.
- [ ] Aprovar avança o gate; recusar volta a OS a **diagnóstico**; sem login pesado.
- [ ] [sucesso] confirmação clara; [erro de rede] permite repetir.
- [ ] [teste] aprovar/recusar + efeito no estado da OS.

---

## Épico M7 — Notificações

### US-15: Como cliente, quero ser avisado por WhatsApp a cada mudança de estágio, para acompanhar sem perguntar.
- [ ] Notifica na transição de estado (RF-10), via provedor.
- [ ] [teste] disparo na transição (com mock do provedor).

---

## Épico M8 — Templates de Ramo (transversal)

### US-16: Como dono, quero escolher o template de ramo, para o sistema vir com estações/gates/gatilhos do meu mundo.
- [ ] 3 templates (retífica pesada/agro, leve, centro automotivo); cada um define estações/gates/gatilhos.
- [ ] **Configurável, não chumbado**.
- [ ] [teste] carga do template correto por tenant.

---

## Épico M9 — Onboarding do usuário (Primeiros passos) — *adição pós-inception (17/06)*

### US-17: Como dono recém-chegado, quero um guia de "Primeiros passos", para saber por onde começar sem me perder.
- [ ] **Card na Home** (painel inicial) que convida e leva ao guia "Primeiros passos".
- [ ] **Rota fixa `/primeiros-passos`**, sempre acessível pelo menu (não some depois do primeiro uso).
- [ ] Conteúdo **didático**, explicando o app com calma e na ordem que faz sentido para quem começa (fonte: `docs/conteudo/primeiros-passos.md`).
- [ ] **Copy anti-IA**: prosa fluida, sem frases curtas picotadas nem travessão em tudo (regra de escrita do projeto).
- [ ] **Visual impecável e anti-IA** (não-genérico), no tema do app; responsivo desktop/mobile; **WCAG 2.2 AA**.
- [ ] [teste] a rota renderiza o conteúdo; o card da Home aponta para ela; estrutura acessível (headings/landmarks).

> Aprovado para construir na **Wave 3d** (UI), usando a skill de design para o visual. Não bloqueia a US-02.

---

## Handoff para execução

### Mapa: artefatos → Spec Kit
- **constitution** ← `CLAUDE.md` + ADRs + Business Case
- **/specify** ← PRD + fatia do Backlog
- **/plan** ← `03_architecture.md` + SRS
- **/tasks** ← EAP + Critérios de Aceite
- **/implement** ← tudo acima, **schema do banco primeiro**

Sem Spec Kit: o mesmo handoff funciona com o Claude Code lendo os `/docs` — leia `01`→`04` +
`CLAUDE.md`, implemente **uma User Story por vez**, schema primeiro, honrando os critérios.

### Prompt de inicialização (colar no agente de execução)
> Aja como Engenheiro de Software Sênior executando um plano SDD. **Passo 1**: leia `CLAUDE.md`
> e os `/docs` (`00`→`04`); o `00_status.md` diz onde paramos. **Passo 2**: antes de qualquer
> código, resuma o plano do primeiro épico do Backlog e confirme que a stack e a estrutura de
> pastas batem 100% com a Fase 3. **Passo 3**: implemente seguindo os Critérios de Aceite,
> começando pelo schema do banco conforme o ERD, com migrations versionadas e políticas RLS.
> **Passo 4**: aplique os RNF de segurança do SRS e os critérios de teste de cada User Story —
> são parte da Definition of Done. **Passo 5**: ao concluir, valide contra os critérios e aponte
> o que não bate. **Regra de ouro**: não desvie do Business Case ou da Arquitetura sem consultar;
> atualize `00_status.md` e os `/docs` afetados.

### Gate dos 6 critérios (rodar antes de cada implement)
Escopo definido · sem ambiguidade · quebrado em tasks pequenas · contexto preservado · validação
possível · sem ilusão de velocidade. Se algum falhar, sinalize e ajuste — não deixe passar.

> **devdead-audit** entra aqui na frente: na validação (Passo 5) e quando já houver código, para
> garantir que o que se afirma do sistema cita arquivo/função e não é alucinação. Como ainda não
> há código, ela ainda não roda.

---

## Resumo da Fase 4
Backlog do MVP com 16 User Stories em 8 épicos, cada uma com critérios de aceite e de teste.
Handoff mapeado (artefatos → Spec Kit / Claude Code), prompt de inicialização e gate dos 6
critérios. **Inception (Fases 1–4) concluída.**
