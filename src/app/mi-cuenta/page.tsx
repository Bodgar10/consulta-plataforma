import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

// Stub protegido (Sprint 1). El portal real del paciente —citas, saldo de
// sesiones— es carril Sonnet, Sprint 2. Aquí solo evitamos el 404 del redirect
// por rol del callback (/mi-cuenta) y dejamos la ruta protegida.
export default async function MiCuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="page-title">Mi cuenta</h1>
        <div className="card space-y-2">
          <p className="muted">
            Esta sección está en construcción (Sprint 2): aquí verás tus próximas citas y
            tu saldo de sesiones.
          </p>
        </div>
      </div>
    </main>
  );
}
