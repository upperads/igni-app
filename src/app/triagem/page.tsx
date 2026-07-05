import { redirect } from "next/navigation";

/**
 * A triagem foi fundida em /os (aba "Por impacto" — a fila ordenada pela regra da vez). Esta rota
 * permanece só como REDIRECT para não quebrar links/bookmarks antigos e os `revalidatePath("/triagem")`.
 */
export default function TriagemPage() {
  redirect("/os?modo=impacto");
}
