"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PAPEIS, type Papel } from "@/domain/auth/papel";
import type { MembroView } from "@/infra/composition/equipe";
import {
  acaoConvidarMembro,
  acaoDesativarMembro,
  acaoMudarPapel,
  acaoReativarMembro,
} from "./actions";

const ROTULO_PAPEL: Record<Papel, string> = {
  dono: "Dono",
  gestor: "Gestor",
  recepcao: "Recepção",
  producao: "Produção",
};

const AJUDA_PAPEL: Record<Papel, string> = {
  dono: "Administra tudo. Exige 2FA.",
  gestor: "Administra tudo. Exige 2FA.",
  recepcao: "Abre OS, orça, atende o cliente.",
  producao: "Só avança etapas no chão. 1 toque.",
};

interface Props {
  equipe: MembroView[];
  /** Id do usuário logado — para não deixar mexer em si mesmo. */
  meuId: string;
}

export function PainelEquipe({ equipe, meuId }: Props) {
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
        onConvidar={(nome, email, papel) =>
          iniciar(async () => {
            setErro(null);
            const r = await acaoConvidarMembro(nome, email, papel);
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
            onMudarPapel={(papel) => rodar(() => acaoMudarPapel(m.id, papel))}
            onDesativar={() => rodar(() => acaoDesativarMembro(m.id))}
            onReativar={() => rodar(() => acaoReativarMembro(m.id))}
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
  onConvidar,
}: {
  pendente: boolean;
  onConvidar: (nome: string, email: string, papel: Papel) => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<Papel>("producao");

  function enviar() {
    if (!nome.trim() || !email.trim()) {
      return;
    }
    onConvidar(nome, email, papel);
    setNome("");
    setEmail("");
    setPapel("producao");
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
          value={papel}
          onChange={(e) => setPapel(e.target.value as Papel)}
          aria-label="Papel"
          className="rounded-md border border-grafite-600 bg-grafite-900 px-3 py-2 font-body text-sm text-aco-100 focus:border-ambar-500 focus:outline-none"
        >
          {PAPEIS.filter((p) => p !== "dono").map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
            </option>
          ))}
        </select>
      </div>
      <p className="mt-2 font-mono text-xs text-aco-500">{AJUDA_PAPEL[papel]}</p>
      <button
        type="button"
        onClick={enviar}
        disabled={pendente || !nome.trim() || !email.trim()}
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
  onMudarPapel,
  onDesativar,
  onReativar,
}: {
  membro: MembroView;
  souEu: boolean;
  pendente: boolean;
  onMudarPapel: (papel: Papel) => void;
  onDesativar: () => void;
  onReativar: () => void;
}) {
  const [confirmando, setConfirmando] = useState(false);

  return (
    <li
      className={
        membro.ativo
          ? "flex flex-wrap items-center gap-3 rounded-lg border border-grafite-700 bg-grafite-850 px-3 py-2.5"
          : "flex flex-wrap items-center gap-3 rounded-lg border border-grafite-700 bg-grafite-900/60 px-3 py-2.5 opacity-70"
      }
    >
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
      {membro.papel === "dono" || souEu ? (
        <span className="rounded-md bg-grafite-700 px-3 py-1.5 font-mono text-xs text-aco-300">
          {ROTULO_PAPEL[membro.papel]}
        </span>
      ) : (
        <select
          value={membro.papel}
          onChange={(e) => onMudarPapel(e.target.value as Papel)}
          disabled={pendente || !membro.ativo}
          aria-label={`Papel de ${membro.nome}`}
          className="rounded-md border border-grafite-600 bg-grafite-900 px-2 py-1.5 font-mono text-xs text-aco-200 focus:border-ambar-500 focus:outline-none disabled:opacity-50"
        >
          {PAPEIS.filter((p) => p !== "dono").map((p) => (
            <option key={p} value={p}>
              {ROTULO_PAPEL[p]}
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
    </li>
  );
}
