import type { AuthSignInPort, SignInInput, SignInResult } from "@/application/ports/auth-signin";

/** Fake em memória da porta de sign-in. Registre credenciais e a identidade que elas resolvem. */
export class FakeAuthSignIn implements AuthSignInPort {
  private readonly creds = new Map<string, { senha: string; authUserId: string; aal2: boolean }>();

  registrar(email: string, senha: string, authUserId: string, aal2 = false): void {
    this.creds.set(email.trim().toLowerCase(), { senha, authUserId, aal2 });
  }

  async entrar({ email, senha }: SignInInput): Promise<SignInResult | null> {
    const c = this.creds.get(email.trim().toLowerCase());
    if (!c || c.senha !== senha) {
      return null;
    }
    return { authUserId: c.authUserId, aal2: c.aal2 };
  }
}
