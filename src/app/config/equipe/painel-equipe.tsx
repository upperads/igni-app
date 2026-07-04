"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ehCargoDono } from "@/domain/auth/cargo";
import { pinValido } from "@/domain/os/pin";
import type { MembroView } from "@/infra/composition/equipe";
import {
  acaoConvidarMembro,
  acaoDefinirPin,
  acaoDesativarMembro,
  acaoLimparPin,
  acaoMudarCargo,
  acaoReativarMembro,
} from "./actions";

export interface CargoOpcao {
  id: string;
  nome: string;
}

interface Props {
  equipe: MembroView[];
  /** Id do usuário logado — para não deixar mexer em si mesmo. */
  meuId: string;
  /** Cargos do tenant, para o seletor de convite e de troca de cargo. */
  cargos: CargoOpcao[];
}

export function PainelEquipe({ equipe, meuId, cargos }: Props) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [convidado, setConvidado] = useState<{ email: string; senha: string } | null>(null);

  function rodar(acao: () => Promise<{ ok: boolean; motivo?: string }>) {
    setErro(null);
    iniciar(async () => {
      const r = await acao();
      if (!r.ok) {
        setErro(r.motivo ?? "Não deu certo. Tente novamente.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {convidado ? (
        <CredencialEntregar
          email={convidado.email}
          senha={convidado.senha}
          onFechar={() => setConvidado(null)}
        />
      ) : null}

      <FormConvite
        pendente={pendente}
        cargos={cargos}
        onConvidar={(nome, email, cargoId) =>
          iniciar(async () => {
            setErro(null);
            const r = await acaoConvidarMembro(nome, email, cargoId);
            if (!r.ok) {
              setErro(r.motivo ?? "Não foi possível convidar.");
              return;
            }
            if (r.senhaProvisoria && r.email) {
              setConvidado({ email: r.email, senha: r.senhaProvisoria });
            }
            router.refresh();
          })
        }
      />

      <ul className="flex flex-col gap-2">
        {equipe.map((m) => (
          <LinhaMembro
            key={m.id}
            membro={m}
            souEu={m.id === meuId}
            pendente={pendente}
            cargos={cargos}
            onMudarCargo={(cargoId) => rodar(() => acaoMudarCargo(m.id, cargoId))}
            onDesativar={() => rodar(() => acaoDesativarMembro(m.id))}
            onReativar={() => rodar(() => acaoReativarMembro(m.id))}
            onDefinirPin={(pin) => rodar(() => acaoDefinirPin(m.id, pin))}
            onLimparPin={() => rodar(() => acaoLimparPin(m.id))}
          />
        ))}
      </ul>

      {erro ? (
        <p role="alert" className="font-body text-sm text-sinal-vermelho">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

function FormConvite({
  pendente,
  cargos,
  onConvidar,
}: {
  pendente: boolean;
  cargos: CargoOpcao[];
  onConvidar: (nome: string, email: string, cargoId: string) => void;
}) {
  const cargosConvidaveis = cargos.filter((c) => !ehCargoDono(c.nome));
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [cargoId, setCargoId] = useState(cargosConvidaveis[0]?.id ?? "");

  function enviar() {
    if (!nome.trim() || !email.trim() || !cargoId) {
      return;
    }
    onConvidar(nome, email, cargoId);
    setNome("");
    setEmail("");
  }

  return (
    <section className="rounded-lg border border-grafite-700 bg-grafite-850 p-4">
      <h2 className="font-display text-lg text-aco-100">Convidar para a equipe</h2>
      <p className="mt-1 max-w-prose font-body text-sm text-aco-400">
        Cada pessoa entra com o próprio login. O Igni gera uma senha provisória que você entrega na
        hora (WhatsApp ou no papel) — ela troca depois. Não precisa esperar e-mail nenhum.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Nome do membro"
          placeholder="Nome"
          className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          aria-label="E-mail do membro (o login da pessoa)"
          placeholder="E-mail (o login da pessoa)"
          className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 placeholder:text-aco-500 focus:border-ambar-500 focus:outline-none"
        />
        <select
          value={cargoId}
          onChange={(e) => setCargoId(e.target.value)}
          aria-label="Cargo"
          className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none"
        >
          {cargosConvidaveis.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={enviar}
        disabled={pendente || !nome.trim() || !email.trim() || !cargoId}
        className="mt-3 rounded-md bg-ambar-500 px-4 py-2 font-display text-sm font-bold text-grafite-900 transition-colors hover:bg-ambar-600 disabled:opacity-50"
      >
        {pendente ? "Convidando…" : "Convidar"}
      </button>
    </section>
  );
}

function CredencialEntregar({
  email,
  senha,
  onFechar,
}: {
  email: string;
  senha: string;
  onFechar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const texto = `Seu acesso ao Igni:\nLogin: ${email}\nSenha provisória: ${senha}\n(troque a senha no primeiro acesso)`;

  function copiar() {
    void navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
    });
  }

  return (
    <section className="rounded-lg border border-ambar-500 bg-grafite-850 p-4">
      <h2 className="font-display text-lg text-ambar-500">Entregue agora — aparece uma vez só</h2>
      <p className="mt-1 font-body text-sm text-aco-300">
        Mande para a pessoa por WhatsApp ou anote. Por segurança, o Igni não guarda esta senha.
      </p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 font-mono text-sm">
        <dt className="text-aco-500">Login</dt>
        <dd className="text-aco-100">{email}</dd>
        <dt className="text-aco-500">Senha</dt>
        <dd className="text-lg font-bold tracking-wider text-ambar-500">{senha}</dd>
      </dl>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copiar}
          className="rounded-md border border-grafite-600 px-3 py-2 font-body text-sm text-aco-200 hover:text-aco-100"
        >
          {copiado ? "Copiado ✓" : "Copiar recado"}
        </button>
        <button
          type="button"
          onClick={onFechar}
          className="rounded-md bg-grafite-700 px-3 py-2 font-body text-sm text-aco-200 hover:text-aco-100"
        >
          Já entreguei
        </button>
      </div>
    </section>
  );
}

function LinhaMembro({
  membro,
  souEu,
  pendente,
  cargos,
  onMudarCargo,
  onDesativar,
  onReativar,
  onDefinirPin,
  onLimparPin,
}: {
  membro: MembroView;
  souEu: boolean;
  pendente: boolean;
  cargos: CargoOpcao[];
  onMudarCargo: (cargoId: string) => void;
  onDesativar: () => void;
  onReativar: () => void;
  onDefinirPin: (pin: string) => void;
  onLimparPin: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const ehDono = ehCargoDono(membro.cargoNome);
  const cargosSelecionaveis = ehDono ? cargos : cargos.filter((c) => !ehCargoDono(c.nome));

  return (
    <li
      className={
        membro.ativo
          ? "flex flex-col gap-2 rounded-lg border border-grafite-700 bg-grafite-850 px-3 py-2.5"
          : "flex flex-col gap-2 rounded-lg border border-grafite-700 bg-grafite-900/60 px-3 py-2.5 opacity-70"
      }
    >
      <div className="flex flex-wrap items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-body text-sm text-aco-100">
          {membro.nome}
          {souEu ? <span className="ml-2 font-mono text-xs text-aco-500">você</span> : null}
          {!membro.ativo ? (
            <span className="ml-2 font-mono text-xs text-sinal-vermelho">desativado</span>
          ) : null}
        </p>
        <p className="truncate font-mono text-xs text-aco-500">{membro.email}</p>
      </div>

        {/* Dono não muda pelo select (é a âncora administrativa); a si mesmo, ninguém mexe. */}
        {ehDono || souEu ? (
          <span className="rounded-md bg-grafite-700 px-3 py-1.5 font-mono text-xs text-aco-300">
            {membro.cargoNome || "Sem cargo"}
          </span>
        ) : (
          <select
            value={membro.cargoId ?? ""}
            onChange={(e) => onMudarCargo(e.target.value)}
            disabled={pendente || !membro.ativo}
            aria-label={`Cargo de ${membro.nome}`}
            className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-mono text-xs text-aco-200 focus:border-ambar-500 focus:outline-none disabled:opacity-50"
          >
            {cargosSelecionaveis.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        )}

        {souEu ? null : membro.ativo ? (
          confirmando ? (
            <span className="flex items-center gap-1">
              <button
                type="button"
                onClick={onDesativar}
                disabled={pendente}
                className="rounded-md bg-sinal-vermelho px-2 py-1.5 font-mono text-xs text-grafite-900 disabled:opacity-50"
              >
                Tirar acesso
              </button>
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="rounded-md px-2 py-1.5 font-mono text-xs text-aco-400 hover:text-aco-100"
              >
                Não
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmando(true)}
              disabled={pendente}
              className="rounded-md border border-grafite-600 px-2 py-1.5 font-mono text-xs text-aco-400 hover:border-sinal-vermelho hover:text-sinal-vermelho disabled:opacity-50"
            >
              Desativar
            </button>
          )
        ) : (
          <button
            type="button"
            onClick={onReativar}
            disabled={pendente}
            className="rounded-md border border-grafite-600 px-2 py-1.5 font-mono text-xs text-aco-300 hover:text-aco-100 disabled:opacity-50"
          >
            Reativar
          </button>
        )}
      </div>

      {membro.cargoNome === "Produção" && membro.ativo ? (
        <PinMembro
          nome={membro.nome}
          pendente={pendente}
          onDefinirPin={onDefinirPin}
          onLimparPin={onLimparPin}
        />
      ) : null}
    </li>
  );
}

function PinMembro({
  nome,
  pendente,
  onDefinirPin,
  onLimparPin,
}: {
  nome: string;
  pendente: boolean;
  onDefinirPin: (pin: string) => void;
  onLimparPin: () => void;
}) {
  const [pin, setPin] = useState("");

  function salvar() {
    if (!pinValido(pin)) {
      return;
    }
    onDefinirPin(pin);
    setPin("");
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-grafite-700 pt-2">
      <label htmlFor={`pin-${nome}`} className="font-mono text-xs text-aco-400">
        PIN (4 dígitos)
      </label>
      <input
        id={`pin-${nome}`}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
        inputMode="numeric"
        maxLength={4}
        aria-label={`PIN de ${nome}`}
        placeholder="0000"
        className="w-20 rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 text-center font-mono text-sm tracking-widest text-aco-100 placeholder:text-aco-600 focus:border-ambar-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={salvar}
        disabled={pendente || !pinValido(pin)}
        className="rounded-md border border-grafite-600 px-2 py-1.5 font-mono text-xs text-aco-300 hover:border-ambar-500 hover:text-ambar-500 disabled:opacity-50"
      >
        Salvar PIN
      </button>
      <button
        type="button"
        onClick={onLimparPin}
        disabled={pendente}
        className="rounded-md px-2 py-1.5 font-mono text-xs text-aco-500 hover:text-sinal-vermelho disabled:opacity-50"
      >
        Limpar PIN
      </button>
    </div>
  );
}
