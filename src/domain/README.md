# `src/domain` — Domínio (regras de negócio puras)

Lógica de negócio **sem dependência de framework, DB ou rede**: máquina de estados da OS,
gates, cálculo da razão crítica (triagem), regra da vez/travamento, derivação das 4 perguntas.
Código aqui é testável em isolamento (unidade) e independente de Next.js/Drizzle — é o que
permite a futura extração de serviços (ADR-003).

Regra: **nada de `import` de `infra` ou de bibliotecas de IO aqui.** O domínio não conhece o
mundo externo; quem orquesta IO é a camada de aplicação.
