import { createClient } from "@/utils/supabase/server";

export default async function BajaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const supabase = await createClient();

  let unsubscribed = false;
  if (token) {
    const { data } = await supabase.rpc("public_unsubscribe_notifications", {
      p_token: token,
    });
    unsubscribed = Boolean((data as { unsubscribed?: boolean } | null)?.unsubscribed);
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16 bg-cream-50">
      <div className="card max-w-md w-full text-center space-y-3">
        <h1 className="page-title">
          {unsubscribed ? "Listo, ya no te llegarán estos avisos" : "No pudimos procesar tu solicitud"}
        </h1>
        <p className="muted">
          {unsubscribed
            ? "Dejaste de recibir correos sobre talleres y cursos nuevos. Puedes cerrar esta ventana."
            : "El enlace no es válido o ya expiró. Si el problema continúa, responde a cualquiera de nuestros correos."}
        </p>
      </div>
    </main>
  );
}
