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
