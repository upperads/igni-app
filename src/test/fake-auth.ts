import type { AuthIdentityPort, CriarIdentidadeInput } from "@/application/ports/auth-identity";
import { EmailJaCadastradoError } from "@/domain/shared/errors";

/**
 * Fake em memória da porta de identidade, para testar o caso de uso sem o Supabase Auth.
 * Registra criações e remoções para asserções (ex.: compensação de saga).
 */
export class FakeAuthIdentity implements AuthIdentityPort {
  private readonly idPorEmail = new Map<string, string>();
  private seq = 0;

  /** Ids criados, na ordem. */
  public readonly criadas: string[] = [];
  /** Ids removidos (compensação), na ordem. */
  public readonly removidas: string[] = [];

  async criarIdentidade({ email }: CriarIdentidadeInput): Promise<string> {
    const chave = email.trim().toLowerCase();
    if (this.idPorEmail.has(chave)) {
      throw new EmailJaCadastradoError(chave);
    }
    this.seq += 1;
    const id = `00000000-0000-4000-8000-${String(this.seq).padStart(12, "0")}`;
    this.idPorEmail.set(chave, id);
    this.criadas.push(id);
    return id;
  }

  async removerIdentidade(authUserId: string): Promise<void> {
    this.removidas.push(authUserId);
    for (const [email, id] of this.idPorEmail) {
      if (id === authUserId) {
        this.idPorEmail.delete(email);
      }
    }
  }
}
