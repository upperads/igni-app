import { describe, expect, it } from "vitest";
import { normalizarWhatsapp, tipoClienteValido } from "@/domain/os/cliente";

describe("cliente — normalização de WhatsApp (chave do reuso)", () => {
  it("o mesmo número em formatos diferentes casa", () => {
    const formas = ["(11) 99999-0001", "11999990001", "+55 11 99999 0001", "55 11 99999-0001"];
    const normalizados = formas.map(normalizarWhatsapp);
    expect(new Set(normalizados).size).toBe(1);
    expect(normalizados[0]).toBe("5511999990001");
  });

  it("antepõe 55 quando falta", () => {
    expect(normalizarWhatsapp("11999990001")).toBe("5511999990001");
  });

  it("preserva 55 quando já está", () => {
    expect(normalizarWhatsapp("5511999990001")).toBe("5511999990001");
  });

  it("número curto demais ou vazio → null (não dá pra reusar com segurança)", () => {
    expect(normalizarWhatsapp("123")).toBeNull();
    expect(normalizarWhatsapp("")).toBeNull();
    expect(normalizarWhatsapp(null)).toBeNull();
    expect(normalizarWhatsapp(undefined)).toBeNull();
  });

  it("tipoClienteValido só aceita os valores canônicos", () => {
    expect(tipoClienteValido("frota")).toBe(true);
    expect(tipoClienteValido("produtor")).toBe(true);
    expect(tipoClienteValido("xx")).toBe(false);
  });
});
