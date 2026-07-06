import { describe, expect, it } from "vitest";
import {
  CARGOS_SEMENTE,
  exigeMfa,
  PERMISSOES,
  pode,
  validarCargo,
} from "@/domain/auth/cargo";
import { DadosInvalidosError } from "@/domain/shared/errors";

describe("cargo — catálogo e pode()", () => {
  it("o catálogo tem exatamente as 11 chaves esperadas", () => {
    expect([...PERMISSOES].sort()).toEqual(
      [
        "cadastro:editar", "config:editar", "dinheiro:ver", "dinheiro:ver_peca",
        "equipe:gerir", "financeiro:gerir", "orcamento:editar", "os:abrir", "os:avancar", "os:editar",
        "triagem:override",
      ].sort(),
    );
  });

  it("pode() confere presença da permissão", () => {
    expect(pode(["os:avancar"], "os:avancar")).toBe(true);
    expect(pode(["os:avancar"], "orcamento:editar")).toBe(false);
  });
});

describe("cargo — validarCargo (pisos 2 e catálogo)", () => {
  it("Piso 2: cargo de chão NÃO pode ver dinheiro nem editar orçamento", () => {
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["dinheiro:ver"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["dinheiro:ver_peca"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["orcamento:editar"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["financeiro:gerir"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "Chão X", chao: true, permissoes: ["os:avancar"] })).not.toThrow();
  });

  it("rejeita permissão fora do catálogo (incl. cargo:gerir, que não é atribuível)", () => {
    expect(() => validarCargo({ nome: "X", chao: false, permissoes: ["cargo:gerir"] })).toThrow(DadosInvalidosError);
    expect(() => validarCargo({ nome: "X", chao: false, permissoes: ["inventada"] })).toThrow(DadosInvalidosError);
  });

  it("rejeita nome vazio", () => {
    expect(() => validarCargo({ nome: "   ", chao: false, permissoes: [] })).toThrow(DadosInvalidosError);
  });
});

describe("cargo — exigeMfa (Piso 3: piso, nunca teto)", () => {
  it("flag próprio força 2FA", () => {
    expect(exigeMfa({ chao: false, exige2fa: true, permissoes: [] })).toBe(true);
  });

  it("permissão-gatilho força 2FA mesmo com flag false", () => {
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["equipe:gerir"] })).toBe(true);
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["config:editar"] })).toBe(true);
  });

  it("dinheiro:ver NÃO é gatilho (recepção fica sem 2FA)", () => {
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["dinheiro:ver", "orcamento:editar", "cadastro:editar"] })).toBe(false);
    expect(exigeMfa({ chao: false, exige2fa: false, permissoes: ["dinheiro:ver_peca"] })).toBe(false);
  });
});

describe("cargo — cargos-semente canônicos", () => {
  it("são 7 e batem com o esperado (fonte única do seed SQL)", () => {
    const nomes = CARGOS_SEMENTE.map((c) => c.nome).sort();
    expect(nomes).toEqual(["Dono", "Financeiro", "Gestor", "Peças/Compras", "Produção", "Pós-venda", "Recepção"].sort());
  });

  it("cada semente respeita seus próprios pisos (chão sem dinheiro; exige2fa coerente com exigeMfa)", () => {
    for (const c of CARGOS_SEMENTE) {
      expect(() => validarCargo({ nome: c.nome, chao: c.chao, permissoes: c.permissoes })).not.toThrow();
      // exige2fa registrado nunca é menor que o piso derivado das permissões
      if (exigeMfa({ chao: c.chao, exige2fa: false, permissoes: c.permissoes })) {
        expect(c.exige2fa).toBe(true);
      }
    }
  });

  it("Recepção vê dinheiro mas NÃO exige 2FA; Financeiro exige", () => {
    const recep = CARGOS_SEMENTE.find((c) => c.nome === "Recepção")!;
    const fin = CARGOS_SEMENTE.find((c) => c.nome === "Financeiro")!;
    expect(recep.permissoes).toContain("dinheiro:ver");
    expect(exigeMfa({ chao: recep.chao, exige2fa: recep.exige2fa, permissoes: recep.permissoes })).toBe(false);
    expect(exigeMfa({ chao: fin.chao, exige2fa: fin.exige2fa, permissoes: fin.permissoes })).toBe(true);
  });
});
