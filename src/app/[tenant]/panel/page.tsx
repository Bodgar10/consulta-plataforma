import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Stub protegido (Sprint 1). El contenido real —agenda, pacientes, cobros— es
// carril Sonnet, Sprint 2. Aquí solo evitamos el 404 del redirect por rol del
// callback (/${tenant_slug}/panel) y dejamos la ruta protegida.
export default async function PanelPage({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="page-title">Panel de la profesional</h1>
        <div className="card space-y-2">
          <p className="muted">
            Esta sección está en construcción (Sprint 2): aquí vivirán tu agenda, tus
            pacientes y tus cobros.
          </p>
        </div>
      </div>
    </main>
  );
}
