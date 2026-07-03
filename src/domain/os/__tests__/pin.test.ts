import { describe, expect, it } from "vitest";
import { normalizarPin, pinValido } from "@/domain/os/pin";

describe("pin — validação (4 dígitos, carimbo de autoria)", () => {
  it("aceita exatamente 4 dígitos", () => {
    expect(pinValido("1234")).toBe(true);
    expect(pinValido("0000")).toBe(true);
  });
  it("rejeita tamanho errado ou não-dígito", () => {
    expect(pinValido("123")).toBe(false);
    expect(pinValido("12345")).toBe(false);
    expect(pinValido("12a4")).toBe(false);
    expect(pinValido("")).toBe(false);
  });
  it("normalizarPin apara e valida; inválido → null", () => {
    expect(normalizarPin("  1234 ")).toBe("1234");
    expect(normalizarPin("12")).toBeNull();
    expect(normalizarPin("abcd")).toBeNull();
  });
});
