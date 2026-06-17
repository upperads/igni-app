# `src/application` — Aplicação (casos de uso)

Orquestra os casos de uso do produto (ex.: criar oficina, abrir OS, avançar etapa, montar
orçamento). Chama o **domínio** para as regras e a **infra** para persistência/integrações,
mas não contém regra de negócio nem detalhe de framework. É o ponto que a camada web
(`src/app`, server actions / route handlers) invoca.
