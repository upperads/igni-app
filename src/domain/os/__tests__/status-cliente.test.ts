import { describe, expect, it } from "vitest";
import { ESTADOS_OS } from "@/domain/os/estado";
import { mensagemWhatsapp, statusCliente } from "@/domain/os/status-cliente";

describe("status do cliente (honestidade simétrica, CDC-safe)", () => {
  it("a bola é do cliente só onde ele decide/age (aprovação e retirada)", () => {
    expect(statusCliente("aguardando_aprovacao").bola).toBe("cliente");
    expect(statusCliente("aguardando_aprovacao").acao).toBe("aprovar");
    expect(statusCliente("pronta").bola).toBe("cliente");
    expect(statusCliente("pronta").acao).toBe("retirar");
  });

  it("nos estados de trabalho a bola é da oficina (transparência, não vergonha)", () => {
    for (const e of ["execucao", "diagnostico", "controle_qualidade", "aguardando_peca"] as const) {
      expect(statusCliente(e).bola).toBe("oficina");
      expect(statusCliente(e).acao).toBeNull();
    }
  });

  it("todo estado tem rótulo e detalhe não vazios, sem a palavra 'culpa'", () => {
    for (const e of ESTADOS_OS) {
      const s = statusCliente(e);
      expect(s.rotulo.length).toBeGreaterThan(0);
      expect(s.detalhe.length).toBeGreaterThan(0);
      expect(s.detalhe.toLowerCase()).not.toContain("culpa");
    }
  });

  it("a mensagem do WhatsApp é factual e inclui o link quando há", () => {
    const msg = mensagemWhatsapp({
      numeroOs: 41,
      equipamento: "Motor Scania",
      status: statusCliente("aguardando_aprovacao"),
      link: "https://x/portal/abc",
    });
    expect(msg).toContain("OS-41");
    expect(msg).toContain("Motor Scania");
    expect(msg).toContain("aprovar");
    expect(msg).toContain("https://x/portal/abc");
    expect(msg.toLowerCase()).not.toContain("culpa");
  });
});
