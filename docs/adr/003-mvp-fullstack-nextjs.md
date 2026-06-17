# ADR-003: MVP full-stack em Next.js, com caminho de extração de serviços

## Contexto
Produto de fundador (operação + venda), com meta de escala mas restrição de tempo/equipe na
largada. Precisa ir rápido ao MVP sem fechar portas para crescer.

## Decisão
Construir o MVP como aplicação **full-stack em Next.js (TypeScript)** — UI + API routes/server
actions no mesmo projeto — com **um serviço dedicado apenas para o canal realtime**. Conforme
a escala exigir, extrair serviços (ex.: API dedicada, workers) sem reescrever o núcleo.

## Alternativas consideradas
- **Microsserviços desde o dia 1**: complexidade operacional alta para um MVP de fundador.
  Descartado para a largada.
- **Backend separado desde já** (ex.: NestJS): mais cerimônia sem ganho imediato no MVP.
  Adiável.

## Consequência
Velocidade máxima no MVP e um só idioma (TS) ponta a ponta. O caminho de extração precisa ser
respeitado: manter a lógica de domínio (máquina de estados, triagem) desacoplada da camada web
para facilitar a futura extração. O canal realtime já nasce como serviço à parte por exigência
técnica (websockets persistentes).
