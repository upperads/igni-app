import { DadosInvalidosError } from "@/domain/shared/errors";

/**
 * Cargos (P-1): o catálogo FIXO de permissões e as regras (pisos) que nenhuma configuração viola.
 * Lógica pura. O banco (`schema/cargo`) guarda o cargo; aqui vive o que cada permissão significa.
 * `cargo:gerir` NÃO está no catálogo atribuível — é implícito e exclusivo do cargo Dono.
 */
export const PERMISSOES = [
  "os:abrir",
  "os:editar",
  "os:avancar",
  "triagem:override",
  "orcamento:editar",
  "dinheiro:ver",
  "dinheiro:ver_peca",
  "cadastro:editar",
  "equipe:gerir",
  "config:editar",
] as const;

export type Permissao = (typeof PERMISSOES)[number];

/** Nome canônico do cargo-raiz. É o identificador do gate `cargo:gerir` — por isso é imutável. */
export const CARGO_DONO = "Dono";

/** Se o cargo é o Dono (cargo-raiz imutável): reconhecido pelo nome canônico. */
export function ehCargoDono(nome: string): boolean {
  return nome === CARGO_DONO;
}

/** Permissões que um cargo de chão (quiosque) NUNCA pode ter (Piso 2 — regra de ouro). */
const PROIBIDAS_NO_CHAO: readonly Permissao[] = ["orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca"];

/** Permissões que FORÇAM 2FA (Piso 3). dinheiro:ver NÃO está aqui de propósito. */
const GATILHOS_2FA: readonly string[] = ["equipe:gerir", "config:editar", "cargo:gerir"];

export interface CargoBase {
  chao: boolean;
  exige2fa: boolean;
  permissoes: readonly string[];
}

function ehPermissaoValida(p: string): p is Permissao {
  return (PERMISSOES as readonly string[]).includes(p);
}

/** Valida um cargo à luz do catálogo e dos pisos. Lança DadosInvalidosError. */
export function validarCargo(input: { nome: string; chao: boolean; permissoes: readonly string[] }): void {
  if (!input.nome.trim()) {
    throw new DadosInvalidosError("Dê um nome ao cargo.");
  }
  for (const p of input.permissoes) {
    if (!ehPermissaoValida(p)) {
      throw new DadosInvalidosError(`Permissão desconhecida: ${p}.`);
    }
  }
  if (input.chao) {
    for (const p of PROIBIDAS_NO_CHAO) {
      if (input.permissoes.includes(p)) {
        throw new DadosInvalidosError("Cargo de chão não pode ver valores nem editar orçamento.");
      }
    }
  }
}

/** 2FA é piso, nunca teto: o flag do cargo OU qualquer permissão-gatilho força 2FA. */
export function exigeMfa(cargo: CargoBase): boolean {
  return cargo.exige2fa || cargo.permissoes.some((p) => GATILHOS_2FA.includes(p));
}

/** RBAC: o cargo pode a ação se a permissão está no seu conjunto. */
export function pode(permissoes: readonly string[], acao: Permissao): boolean {
  return permissoes.includes(acao);
}

export interface SementeCargo {
  nome: string;
  sistema: true;
  chao: boolean;
  exige2fa: boolean;
  permissoes: readonly Permissao[];
}

/**
 * Os 7 cargos-semente canônicos. FONTE ÚNICA — o seed SQL (migration) espelha isto; o teste de
 * drift garante que não divergem. Ordem = ordem de exibição sugerida.
 */
export const CARGOS_SEMENTE: readonly SementeCargo[] = [
  { nome: "Dono", sistema: true, chao: false, exige2fa: true,
    permissoes: ["os:abrir", "os:editar", "os:avancar", "triagem:override", "orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca", "cadastro:editar", "equipe:gerir", "config:editar"] },
  { nome: "Gestor", sistema: true, chao: false, exige2fa: true,
    permissoes: ["os:abrir", "os:editar", "os:avancar", "triagem:override", "orcamento:editar", "dinheiro:ver", "dinheiro:ver_peca", "cadastro:editar", "equipe:gerir", "config:editar"] },
  { nome: "Recepção", sistema: true, chao: false, exige2fa: false,
    permissoes: ["os:abrir", "os:editar", "os:avancar", "orcamento:editar", "dinheiro:ver", "cadastro:editar", "triagem:override"] },
  { nome: "Produção", sistema: true, chao: true, exige2fa: false,
    permissoes: ["os:avancar"] },
  { nome: "Financeiro", sistema: true, chao: false, exige2fa: true,
    permissoes: ["dinheiro:ver", "orcamento:editar", "os:editar"] },
  { nome: "Peças/Compras", sistema: true, chao: false, exige2fa: false,
    permissoes: ["dinheiro:ver_peca", "os:avancar"] },
  { nome: "Pós-venda", sistema: true, chao: false, exige2fa: false,
    permissoes: ["os:avancar", "cadastro:editar"] },
];
