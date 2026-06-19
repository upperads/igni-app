"use server";

import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/infra/auth/supabase-server";

/** Encerra a sessão (limpa os cookies do Supabase) e volta ao login. */
export async function sair() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
