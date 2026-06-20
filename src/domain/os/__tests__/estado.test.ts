import { describe, expect, it } from "vitest";
import {
  type ContextoTransicao,
  ESTADOS_OS,
  type EstadoOS,
  proximoBump,
  proximosEstados,
  quatroPerguntas,
  validarTransicao,
} from "@/domain/os/estado";
import { estadoOs } from "@/infra/db/schema";

const APROVADO: ContextoTransicao = { orcamentoAprovado: true, cqAprovado: true };
const NADA: ContextoTransicao = { orcamentoAprovado: false, cqAprovado: false };

describe("máquina de estados da OS (US-05)", () => {
  it("permite o caminho feliz completo", () => {
    const caminho: Array<[EstadoOS, EstadoOS]> = [
      ["aberta", "diagnostico"],
      ["diagnostico", "orcamento"],
      ["orcamento", "aguardando_aprovacao"],
      ["aguardando_aprovacao", "execucao"],
      ["execucao", "controle_qualidade"],
      ["controle_qualidade", "pronta"],
      ["pronta", "entregue"],
    ];
    for (const [de, para] of caminho) {
      expect(validarTransicao(de, para, APROVADO).ok).toBe(true);
    }
  });

  it("barra transição estruturalmente inválida", () => {
    const r = validarTransicao("aberta", "execucao", APROVADO);
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/inválida/i);
  });

  it("GATE: não usina sem orçamento aprovado", () => {
    expect(validarTransicao("aguardando_aprovacao", "execucao", NADA).ok).toBe(false);
    expect(validarTransicao("aguardando_aprovacao", "execucao", NADA).motivo).toMatch(/orçamento aprovado/i);
    expect(validarTransicao("aguardando_peca", "execucao", NADA).ok).toBe(false);
    expect(validarTransicao("aguardando_aprovacao", "execucao", { orcamentoAprovado: true, cqAprovado: false }).ok).toBe(true);
  });

  it("GATE: não passa do CQ sem aprovação", () => {
    expect(validarTransicao("controle_qualidade", "pronta", NADA).ok).toBe(false);
    expect(validarTransicao("controle_qualidade", "pronta", NADA).motivo).toMatch(/controle de qualidade/i);
    expect(validarTransicao("controle_qualidade", "pronta", { orcamentoAprovado: true, cqAprovado: true }).ok).toBe(true);
  });

  it("fluxos de exceção: orçamento recusado volta a diagnóstico; CQ reprovado volta a execução", () => {
    expect(validarTransicao("aguardando_aprovacao", "diagnostico", NADA).ok).toBe(true);
    // retrabalho: CQ → execução (orçamento já aprovado nesse ponto).
    expect(validarTransicao("controle_qualidade", "execucao", APROVADO).ok).toBe(true);
  });

  it("entregue é terminal", () => {
    expect(proximosEstados("entregue")).toHaveLength(0);
  });

  it("as 4 perguntas respondem para todos os estados, sem texto vazio", () => {
    for (const estado of ESTADOS_OS) {
      const q = quatroPerguntas(estado);
      for (const campo of [q.onde, q.porque, q.oQueFalta, q.praOnde]) {
        expect(campo.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("o enum estado_os do banco espelha ESTADOS_OS (sem drift)", () => {
    expect([...estadoOs.enumValues].sort()).toEqual([...ESTADOS_OS].sort());
  });

  it("proximoBump dá o único passo adiante; null quando ramifica ou termina", () => {
    expect(proximoBump("aberta")).toBe("diagnostico");
    expect(proximoBump("aguardando_peca")).toBe("execucao");
    expect(proximoBump("execucao")).toBe("controle_qualidade");
    expect(proximoBump("pronta")).toBe("entregue");
    // ramificam (decisão) → sem bump
    expect(proximoBump("aguardando_aprovacao")).toBeNull();
    expect(proximoBump("controle_qualidade")).toBeNull();
    // terminal → sem bump
    expect(proximoBump("entregue")).toBeNull();
  });
});
