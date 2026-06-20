import { describe, expect, it } from "vitest";
import {
  CONFIG_TRIAGEM_PADRAO,
  classificarPrioridade,
  diasRestantesAte,
  gatilhosAtivos,
  type Gatilhos,
  type ItemFila,
  ordenarFila,
  perdeAVez,
  PRIORIDADES,
  razaoCritica,
  RESPONSABILIDADES,
  trabalhoRestante,
} from "@/domain/os/triagem";
import { prioridadeOs, responsabilidade } from "@/infra/db/schema";

const SEM_GATILHO: Gatilhos = { frotaParada: false, maquinaUnica: false, retrabalhoGarantia: false };

describe("triagem — trabalho restante (etapas até entregue)", () => {
  it("decresce ao longo da linha; entregue = 0", () => {
    expect(trabalhoRestante("aberta")).toBe(8);
    expect(trabalhoRestante("execucao")).toBe(3);
    expect(trabalhoRestante("pronta")).toBe(1);
    expect(trabalhoRestante("entregue")).toBe(0);
  });
});

describe("triagem — dias restantes (UTC, calendário)", () => {
  const agora = new Date("2026-06-19T12:00:00Z");

  it("prazo hoje = 0, futuro positivo, passado negativo", () => {
    expect(diasRestantesAte("2026-06-19", agora)).toBe(0);
    expect(diasRestantesAte("2026-06-26", agora)).toBe(7);
    expect(diasRestantesAte("2026-06-17", agora)).toBe(-2);
  });

  it("sem prazo = null", () => {
    expect(diasRestantesAte(null, agora)).toBeNull();
  });
});

describe("triagem — gatilhos do ramo (RN-02)", () => {
  it("frota parada quando o cliente é frota", () => {
    expect(gatilhosAtivos({ tipoCliente: "frota", maquinaUnica: false, houveCqReprovado: false }).frotaParada).toBe(true);
    expect(gatilhosAtivos({ tipoCliente: "avulso", maquinaUnica: false, houveCqReprovado: false }).frotaParada).toBe(false);
  });

  it("máquina única só conta para produtor", () => {
    expect(gatilhosAtivos({ tipoCliente: "produtor", maquinaUnica: true, houveCqReprovado: false }).maquinaUnica).toBe(true);
    expect(gatilhosAtivos({ tipoCliente: "frota", maquinaUnica: true, houveCqReprovado: false }).maquinaUnica).toBe(false);
  });

  it("retrabalho de garantia quando houve CQ reprovado", () => {
    expect(gatilhosAtivos({ tipoCliente: "avulso", maquinaUnica: false, houveCqReprovado: true }).retrabalhoGarantia).toBe(true);
  });
});

describe("triagem — razão crítica e bucket (US-07)", () => {
  it("muito prazo e pouco trabalho → baixa", () => {
    const r = razaoCritica({ diasRestantes: 30, trabalhoRestante: 3, gatilhos: SEM_GATILHO });
    expect(r.prioridade).toBe("baixa");
  });

  it("prazo apertado com bastante trabalho → alta", () => {
    const r = razaoCritica({ diasRestantes: 1, trabalhoRestante: 5, gatilhos: SEM_GATILHO });
    expect(r.score).toBeCloseTo(5, 5);
    expect(r.prioridade).toBe("alta");
  });

  it("atrasada → crítica (bônus de atraso)", () => {
    const r = razaoCritica({ diasRestantes: -2, trabalhoRestante: 3, gatilhos: SEM_GATILHO });
    // 3/0.5 + 5 = 11 → crítica
    expect(r.score).toBeCloseTo(11, 5);
    expect(r.prioridade).toBe("critica");
  });

  it("sem prazo: só os gatilhos pesam", () => {
    const semNada = razaoCritica({ diasRestantes: null, trabalhoRestante: 5, gatilhos: SEM_GATILHO });
    expect(semNada.score).toBe(0);
    const comFrota = razaoCritica({
      diasRestantes: null,
      trabalhoRestante: 5,
      gatilhos: { ...SEM_GATILHO, frotaParada: true },
    });
    expect(comFrota.score).toBe(CONFIG_TRIAGEM_PADRAO.pesos.frotaParada);
  });

  it("gatilhos são aditivos e podem subir o bucket", () => {
    const base = razaoCritica({ diasRestantes: 2, trabalhoRestante: 6, gatilhos: SEM_GATILHO });
    const comGatilhos = razaoCritica({
      diasRestantes: 2,
      trabalhoRestante: 6,
      gatilhos: { frotaParada: true, maquinaUnica: false, retrabalhoGarantia: true },
    });
    expect(comGatilhos.score).toBeGreaterThan(base.score);
    // 6/2=3 +3(frota) +2(retrabalho) = 8 → crítica
    expect(comGatilhos.score).toBeCloseTo(8, 5);
    expect(comGatilhos.prioridade).toBe("critica");
  });

  it("classificarPrioridade respeita os limiares configurados", () => {
    expect(classificarPrioridade(8, CONFIG_TRIAGEM_PADRAO)).toBe("critica");
    expect(classificarPrioridade(4, CONFIG_TRIAGEM_PADRAO)).toBe("alta");
    expect(classificarPrioridade(1, CONFIG_TRIAGEM_PADRAO)).toBe("normal");
    expect(classificarPrioridade(0.5, CONFIG_TRIAGEM_PADRAO)).toBe("baixa");
  });
});

describe("triagem — regra da vez (US-08 / RN-03)", () => {
  it("perde a vez só travado por culpa do cliente", () => {
    expect(perdeAVez(true, "cliente")).toBe(true);
    expect(perdeAVez(true, "empresa")).toBe(false);
    expect(perdeAVez(false, "cliente")).toBe(false);
  });

  const base = (over: Partial<ItemFila>): ItemFila => ({
    prioridade: "alta",
    score: 5,
    travado: false,
    travamentoResponsabilidade: null,
    criadoEm: new Date("2026-06-01T00:00:00Z"),
    ...over,
  });

  it("prioridade manda sobre tudo", () => {
    const fila = ordenarFila([
      base({ prioridade: "baixa" }),
      base({ prioridade: "critica" }),
      base({ prioridade: "normal" }),
    ]);
    expect(fila.map((i) => i.prioridade)).toEqual(["critica", "normal", "baixa"]);
  });

  it("travado por cliente cai dentro do mesmo bucket; por empresa mantém a vez", () => {
    const movel = base({ score: 5, criadoEm: new Date("2026-06-02T00:00:00Z") });
    const empresa = base({ score: 5, travado: true, travamentoResponsabilidade: "empresa", criadoEm: new Date("2026-06-03T00:00:00Z") });
    const cliente = base({ score: 9, travado: true, travamentoResponsabilidade: "cliente", criadoEm: new Date("2026-06-01T00:00:00Z") });

    const fila = ordenarFila([cliente, movel, empresa]);
    // cliente, mesmo com score maior, perde a vez e vai ao fim do bucket
    expect(fila[fila.length - 1]).toBe(cliente);
    // entre os que mantêm a vez, desempata por score (iguais) e FIFO
    expect(fila[0]).toBe(movel);
  });

  it("desempate final por ordem de chegada (FIFO)", () => {
    const cedo = base({ criadoEm: new Date("2026-06-01T00:00:00Z") });
    const tarde = base({ criadoEm: new Date("2026-06-05T00:00:00Z") });
    const fila = ordenarFila([tarde, cedo]);
    expect(fila).toEqual([cedo, tarde]);
  });

  it("não muta a entrada", () => {
    const entrada = [base({ prioridade: "baixa" }), base({ prioridade: "critica" })];
    const copia = [...entrada];
    ordenarFila(entrada);
    expect(entrada).toEqual(copia);
  });
});

describe("triagem — drift dos enums do banco", () => {
  it("prioridade_os espelha PRIORIDADES", () => {
    expect([...prioridadeOs.enumValues].sort()).toEqual([...PRIORIDADES].sort());
  });

  it("responsabilidade espelha RESPONSABILIDADES", () => {
    expect([...responsabilidade.enumValues].sort()).toEqual([...RESPONSABILIDADES].sort());
  });
});
