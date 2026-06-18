import { describe, expect, it } from "vitest";
import { avaliarLockout, type PoliticaLockout } from "@/domain/auth/lockout";

const politica: PoliticaLockout = { maxTentativas: 5, janelaMs: 15 * 60 * 1000 };
const agora = new Date("2026-06-17T12:00:00.000Z");

function minutosAtras(min: number): Date {
  return new Date(agora.getTime() - min * 60 * 1000);
}

describe("avaliarLockout", () => {
  it("não bloqueia abaixo do limite e conta as tentativas restantes", () => {
    const r = avaliarLockout([minutosAtras(1), minutosAtras(2)], politica, agora);
    expect(r.bloqueado).toBe(false);
    expect(r.tentativasRestantes).toBe(3);
    expect(r.desbloqueioEm).toBeNull();
  });

  it("bloqueia ao atingir o limite e informa quando desbloqueia", () => {
    const falhas = [minutosAtras(5), minutosAtras(4), minutosAtras(3), minutosAtras(2), minutosAtras(1)];
    const r = avaliarLockout(falhas, politica, agora);
    expect(r.bloqueado).toBe(true);
    expect(r.tentativasRestantes).toBe(0);
    // desbloqueio = última falha (1 min atrás) + 15 min de janela
    expect(r.desbloqueioEm).toEqual(new Date(minutosAtras(1).getTime() + politica.janelaMs));
  });

  it("ignora falhas fora da janela", () => {
    const falhas = [minutosAtras(60), minutosAtras(40), minutosAtras(20), minutosAtras(2), minutosAtras(1)];
    const r = avaliarLockout(falhas, politica, agora);
    // só 2 estão dentro dos 15 min → não bloqueia
    expect(r.bloqueado).toBe(false);
    expect(r.tentativasRestantes).toBe(3);
  });
});
