import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: context } = await supabase
    .rpc("current_user_context")
    .maybeSingle();

  if (context?.is_professional) {
    redirect("/agenda");
  }

  if (context?.tenant_slug) {
    redirect("/mi-cuenta");
  }

  // Sesión válida pero sin contexto reconocido (ni profesional ni paciente
  // ligado a ningún tenant): no hay a dónde mandarlo con certeza.
  redirect("/login");
}
