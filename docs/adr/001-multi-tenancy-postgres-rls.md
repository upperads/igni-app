# ADR-001: PostgreSQL com Row-Level Security para isolamento multi-tenant

## Contexto
O produto é um SaaS multi-tenant (muitas oficinas, dados sensíveis: clientes, placa, chassi).
O isolamento entre tenants é requisito de segurança (RNF-SEC-03) e não pode depender só da
camada de aplicação, que é falível.

## Decisão
Usar **PostgreSQL** como banco primário com **Row-Level Security (RLS)**: cada tabela com
`tenant_id` e políticas RLS que filtram por tenant em toda consulta. Banco compartilhado,
isolamento lógico forçado no nível do banco.

## Alternativas consideradas
- **Banco/schema por tenant**: isolamento físico maior, mas custo operacional e de migração
  alto para dezenas/centenas de oficinas pequenas. Descartado para o estágio atual.
- **Isolamento só na aplicação** (WHERE tenant_id): frágil — um esquecimento vaza dados entre
  oficinas. Descartado.
- **Banco NoSQL**: perde integridade referencial e ACID, necessários para estados, eventos e o
  financeiro da onda 2. Descartado.

## Consequência
Isolamento forte e barato no estágio atual; integridade relacional e ACID garantidos. Exige
disciplina: toda tabela nova precisa de `tenant_id` e política RLS na mesma migration. Caminho
de evolução para isolamento físico permanece aberto se algum cliente grande exigir.
