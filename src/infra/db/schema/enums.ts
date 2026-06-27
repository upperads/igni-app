import { pgEnum } from "drizzle-orm/pg-core";

/** Papéis de acesso (RBAC, RNF-SEC-02 / US-03). O admin da oficina nasce como `dono`. */
export const papelUsuario = pgEnum("papel_usuario", [
  "dono",
  "gestor",
  "recepcao",
  "producao",
]);

/** Template de ramo escolhido na criação da oficina (RN-06 / US-16). */
export const templateRamo = pgEnum("template_ramo", [
  "retifica_pesada_agro",
  "retifica_leve",
  "centro_automotivo",
]);

/** Estados da OS (M2 / ADR-008). Espelha `ESTADOS_OS` do domínio (teste de drift garante). */
export const estadoOs = pgEnum("estado_os", [
  "aberta",
  "diagnostico",
  "orcamento",
  "aguardando_aprovacao",
  "aguardando_peca",
  "execucao",
  "controle_qualidade",
  "pronta",
  "entregue",
]);

/** Modalidade de entrada (A/B/C do PRD): só usinagem · empresa retira · cliente entrega desmontado. */
export const modalidadeEntrada = pgEnum("modalidade_entrada", [
  "so_usinagem",
  "empresa_retira",
  "ja_desmontado",
]);

/** Tipo de cliente (P4 do PRD). */
export const tipoCliente = pgEnum("tipo_cliente", ["frota", "produtor", "avulso"]);

/** Prioridade da OS (bucket da triagem, M3 / ADR-009). Espelha `PRIORIDADES` do domínio (teste de drift). */
export const prioridadeOs = pgEnum("prioridade_os", ["critica", "alta", "normal", "baixa"]);

/** Responsabilidade do travamento (M3 / RN-03): de quem é a bola enquanto a OS está travada. */
export const responsabilidade = pgEnum("responsabilidade", ["empresa", "cliente"]);

/** Status do orçamento (M5 / US-12). Espelha `STATUS_ORCAMENTO` do domínio (teste de drift). */
export const statusOrcamento = pgEnum("status_orcamento", [
  "rascunho",
  "enviado",
  "aprovado",
  "recusado",
]);

/** Tipo de item do orçamento (M5): peça, mão de obra ou serviço de terceiro (com markup %). */
export const tipoItemOrcamento = pgEnum("tipo_item_orcamento", [
  "peca",
  "mao_de_obra",
  "terceiro",
]);

/** De onde veio a transição da OS — a métrica de ADOÇÃO DO CHÃO (chão vs escritório). */
export const origemEvento = pgEnum("origem_evento", [
  "escritorio",
  "chao",
  "cliente",
  "sistema",
]);
