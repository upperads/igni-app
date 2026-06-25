# ADR-011: Número sequencial de OS por tenant via tabela-contador

## Contexto
O card e o detalhe da OS exibem hoje uma ref curta derivada do UUID (`refCurta(id)` em
[composition/os.ts](../../src/infra/composition/os.ts)) — o chão de oficina não decora "a1b2c3d4"
(PRD F4, [07](../07_prd.md); branding "a língua do chão", [05](../05_branding.md)). Precisamos de um
número legível, **sequencial por oficina** ("OS-41" é da oficina, não global), estável e único por tenant.

## Decisão
Coluna `os.numero integer NOT NULL` + `UNIQUE(tenant_id, numero)`. Geração por uma **tabela-contador
por tenant**:

```
tenant_contador_os { tenant_id uuid PK → tenant(id) ON DELETE CASCADE, proximo integer NOT NULL DEFAULT 1 }
```

Dentro da transação de `abrirOS` (que já é `withTenant`, RLS ativa):
```sql
INSERT INTO tenant_contador_os (tenant_id) VALUES ($t)
  ON CONFLICT (tenant_id) DO UPDATE SET proximo = tenant_contador_os.proximo + 1
  RETURNING proximo - (CASE WHEN xmax = 0 THEN 0 ELSE 1 END) AS numero;
```
(ou, mais simples e explícito: um `UPDATE ... RETURNING` após garantir a linha; a essência é o
**lock de linha** do contador serializar a numeração.)

RLS por tenant na tabela-contador (padrão 0007/0009/0011: GRANT app_user + ENABLE sem FORCE + policy
`tenant_id = current_setting('app.current_tenant', true)::uuid`). Migration estrutural via `db:generate`
+ migration custom de RLS. Backfill: numerar as OS existentes por `created_at` por tenant antes de aplicar
o `NOT NULL`.

## Alternativas consideradas
- **`SEQUENCE` do Postgres**: é **global ao banco**, não por-tenant — produziria "OS-1, OS-7, OS-12"
  intercalando oficinas. Descartado (viola "sequencial por oficina").
- **`MAX(numero)+1` em leitura solta**: corrida sob concorrência (duas recepções abrindo OS ao mesmo
  tempo geram o mesmo número e violam o `UNIQUE`, derrubando uma transação). Descartado por não ser
  race-safe.
- **UUID/hash como hoje**: ilegível para o chão. É o problema que estamos resolvendo.

## Consequência
Numeração legível e race-safe ao custo de **uma tabela a mais** e uma escrita extra na abertura da OS
(trivial no volume de dezenas de OS/dia). O `UNIQUE(tenant_id, numero)` é a rede de segurança final. A
numeração é exibida em card/detalhe/portal; substitui o `refCurta` no que é voltado ao humano (o `id`
UUID segue como chave técnica/URL).
