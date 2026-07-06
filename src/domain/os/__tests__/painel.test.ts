import { describe, expect, it } from "vitest";
import {
  calcularBola,
  calcularKpis,
  culpaDoAtraso,
  type EventoGestao,
  type EventoTransicao,
  type ItemKpi,
  metricasAdocao,
  relatorioGestao,
  resumoCulpa,
  sinalDaOs,
} from "@/domain/os/painel";

describe("painel — de quem é a bola (responsabilização)", () => {
  const base = {
    travado: false,
    travamentoResponsabilidade: null,
    travamentoMotivo: null,
    orcamentoAprovado: false,
  };

  it("aguardando_aprovacao SEM aprovação → bola do cliente (esperando ele aprovar)", () => {
    const r = calcularBola({ ...base, estado: "aguardando_aprovacao" });
    expect(r.bola).toBe("cliente");
  });

  it("BUG [F]: aguardando_aprovacao COM orçamento aprovado → bola da OFICINA (não 'esperando o cliente')", () => {
    // O cliente já aprovou; a OS ainda está em aguardando_aprovacao porque mover é o 2º passo.
    // Antes da correção, isto retornava 'cliente' com 'esperando o cliente aprovar' — factualmente errado.
    const r = calcularBola({ ...base, estado: "aguardando_aprovacao", orcamentoAprovado: true });
    expect(r.bola).toBe("oficina");
    expect(r.detalhe.toLowerCase()).not.toContain("esperando o cliente");
  });

  it("travado por cliente → bola do cliente", () => {
    const r = calcularBola({ ...base, estado: "execucao", travado: true, travamentoResponsabilidade: "cliente" });
    expect(r.bola).toBe("cliente");
  });

  it("aguardando_peca → bola da peça", () => {
    expect(calcularBola({ ...base, estado: "aguardando_peca" }).bola).toBe("peca");
  });

  it("em execução normal → bola da oficina", () => {
    expect(calcularBola({ ...base, estado: "execucao" }).bola).toBe("oficina");
  });
});

describe("painel — sinal da OS (precedência)", () => {
  it("travado vence tudo → aguardando", () => {
    expect(sinalDaOs({ prioridade: "critica", travado: true, diasRestantes: -5 })).toBe("aguardando");
  });

  it("crítica (não travada) → critico", () => {
    expect(sinalDaOs({ prioridade: "critica", travado: false, diasRestantes: 10 })).toBe("critico");
  });

  it("prazo vencido (não crítica) → atraso", () => {
    expect(sinalDaOs({ prioridade: "normal", travado: false, diasRestantes: -1 })).toBe("atraso");
  });

  it("alta dentro do prazo → atencao", () => {
    expect(sinalDaOs({ prioridade: "alta", travado: false, diasRestantes: 3 })).toBe("atencao");
  });

  it("normal/baixa dentro do prazo → emdia", () => {
    expect(sinalDaOs({ prioridade: "normal", travado: false, diasRestantes: 9 })).toBe("emdia");
    expect(sinalDaOs({ prioridade: "baixa", travado: false, diasRestantes: null })).toBe("emdia");
  });
});

describe("painel — culpa do atraso (separação)", () => {
  it("travado por cliente → cliente", () => {
    expect(culpaDoAtraso({ travado: true, responsabilidade: "cliente", estado: "execucao" })).toBe("cliente");
  });

  it("aguardando peça → peca", () => {
    expect(culpaDoAtraso({ travado: false, responsabilidade: null, estado: "aguardando_peca" })).toBe("peca");
  });

  it("o resto é por nossa conta → nossa", () => {
    expect(culpaDoAtraso({ travado: false, responsabilidade: null, estado: "execucao" })).toBe("nossa");
    // travado pela empresa também é nossa
    expect(culpaDoAtraso({ travado: true, responsabilidade: "empresa", estado: "execucao" })).toBe("nossa");
  });
});

describe("painel — KPIs (US-11)", () => {
  const item = (over: Partial<ItemKpi>): ItemKpi => ({
    prioridade: "normal",
    travado: false,
    travamentoResponsabilidade: null,
    estado: "execucao",
    diasRestantes: 5,
    ...over,
  });

  it("conta na casa, parada crítica e travadas", () => {
    const k = calcularKpis([
      item({ prioridade: "critica" }),
      item({ travado: true, travamentoResponsabilidade: "empresa" }),
      item({}),
    ]);
    expect(k.naCasa).toBe(3);
    expect(k.paradaCritica).toBe(1);
    expect(k.travadas).toBe(1);
  });

  it("atraso separa a culpa (nossa / cliente / peça)", () => {
    const k = calcularKpis([
      item({ diasRestantes: -2 }), // nossa
      item({ diasRestantes: -1, travado: true, travamentoResponsabilidade: "cliente" }), // cliente
      item({ diasRestantes: -3, estado: "aguardando_peca" }), // peça
      item({ diasRestantes: 4 }), // em dia, não conta
    ]);
    expect(k.atraso.total).toBe(3);
    expect(k.atraso.nossa).toBe(1);
    expect(k.atraso.cliente).toBe(1);
    expect(k.atraso.peca).toBe(1);
  });

  it("fila vazia zera tudo", () => {
    const k = calcularKpis([]);
    expect(k).toEqual({ naCasa: 0, paradaCritica: 0, travadas: 0, atraso: { total: 0, nossa: 0, cliente: 0, peca: 0 } });
  });
});

describe("painel — histórico de responsabilização (resumoCulpa)", () => {
  it("conta episódios de espera/retrabalho por responsável", () => {
    const eventos: EventoTransicao[] = [
      { deEstado: "orcamento", paraEstado: "aguardando_aprovacao" }, // cliente
      { deEstado: "aguardando_aprovacao", paraEstado: "aguardando_peca" }, // peça
      { deEstado: "controle_qualidade", paraEstado: "execucao" }, // retrabalho nosso
      { deEstado: "aberta", paraEstado: "diagnostico" }, // não conta
      { deEstado: "execucao", paraEstado: "controle_qualidade" }, // não conta
    ];
    const r = resumoCulpa(eventos);
    expect(r).toEqual({ total: 3, nossa: 1, cliente: 1, peca: 1 });
  });

  it("sem episódios de espera → zero", () => {
    expect(resumoCulpa([{ deEstado: "aberta", paraEstado: "diagnostico" }])).toEqual({
      total: 0,
      nossa: 0,
      cliente: 0,
      peca: 0,
    });
  });
});

describe("painel — métricas de gestão (P1, ROI)", () => {
  it("adoção do chão: % dos avanços feitos pelo chão (exclui abertura)", () => {
    const eventos: EventoGestao[] = [
      { deEstado: null, paraEstado: "aberta", origem: "escritorio" }, // abertura, não conta
      { deEstado: "aberta", paraEstado: "diagnostico", origem: "chao" },
      { deEstado: "diagnostico", paraEstado: "orcamento", origem: "chao" },
      { deEstado: "execucao", paraEstado: "controle_qualidade", origem: "escritorio" },
    ];
    const m = metricasAdocao(eventos);
    expect(m.total).toBe(3);
    expect(m.chao).toBe(2);
    expect(m.escritorio).toBe(1);
    expect(m.pctChao).toBe(67);
  });

  it("relatório de gestão: adoção + culpa + % fora da alçada da oficina", () => {
    const eventos: EventoGestao[] = [
      { deEstado: "orcamento", paraEstado: "aguardando_aprovacao", origem: "escritorio" }, // cliente
      { deEstado: "aguardando_aprovacao", paraEstado: "aguardando_peca", origem: "chao" }, // peça
      { deEstado: "controle_qualidade", paraEstado: "execucao", origem: "chao" }, // nossa
    ];
    const r = relatorioGestao(eventos);
    expect(r.culpa).toEqual({ total: 3, nossa: 1, cliente: 1, peca: 1 });
    expect(r.pctForaDaAlcada).toBe(67); // (cliente+peca)/total = 2/3
    expect(r.adocao.total).toBe(3);
    expect(r.adocao.chao).toBe(2);
  });

  it("período vazio não quebra (0%)", () => {
    const r = relatorioGestao([]);
    expect(r.adocao.pctChao).toBe(0);
    expect(r.pctForaDaAlcada).toBe(0);
  });
});
