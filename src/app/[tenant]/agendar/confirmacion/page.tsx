import { createClient } from "@/utils/supabase/server";

interface TenantPaymentInfo {
  accepts_transfer: boolean;
  banco: string | null;
  titular: string | null;
  clabe: string | null;
}

async function getTenantPaymentInfo(slug: string): Promise<TenantPaymentInfo | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_get_tenant_by_slug", {
    p_slug: slug,
  });
  if (error || !data || data.length === 0) return null;
  return data[0].payment_settings as unknown as TenantPaymentInfo;
}

export default async function ConfirmacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams: Promise<{ appt?: string }>;
}) {
  const { tenant } = await params;
  const { appt } = await searchParams;

  const supabase = await createClient();

  // Estado real desde BD — nunca se confía en query params para decidir el mensaje.
  let status: string | null = null;
  let paymentMode: string | null = null;
  if (appt) {
    const { data } = await supabase.rpc("public_get_appointment_status", {
      p_appointment_id: appt,
    });
    const parsed = data as { status?: string; payment_mode?: string } | null;
    status = parsed?.status ?? null;
    paymentMode = parsed?.payment_mode ?? null;
  }

  const isConfirmed = status === "confirmed";
  const isPendingVerification = status === "pending_verification";
  const isPendingPayment = status === "pending_payment";

  const paymentInfo =
    isPendingVerification && paymentMode === "transfer" ? await getTenantPaymentInfo(tenant) : null;

  // Nav consciente de sesión: si hay cuenta, ofrece ir directo a "Mi cuenta";
  // si no, el regreso es a la landing del tenant (que ya resuelve sola cuál
  // mostrar).
  const { data: { user } } = await supabase.auth.getUser();

  let badgeClass = "badge-pending";
  let title = "Estamos procesando tu solicitud";
  let message = "Si acabas de completar tu pago, dános un momento y revisa tu correo.";

  if (isConfirmed) {
    badgeClass = "badge-confirmed";
    title = "¡Listo! Tu sesión está agendada";
    message = "Te enviamos la confirmación con el enlace de tu sesión a tu correo.";
  } else if (isPendingVerification) {
    title = "Revisa tu correo";
    message =
      paymentMode === "transfer"
        ? "Te enviamos los siguientes pasos para completar tu pago y confirmar tu sesión. Si no lo ves en unos minutos, revisa spam."
        : "Tu reserva está pendiente de verificación.";
  } else if (isPendingPayment) {
    title = "Estamos confirmando tu pago";
    message = "En cuanto se confirme, te llegará un correo con el enlace de tu sesión.";
  } else if (!appt || !status) {
    title = "No encontramos esa reserva";
    message = "El enlace no es válido o la cita ya no existe.";
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="card max-w-md w-full text-center space-y-4">
        <span className={`${badgeClass} mx-auto`}>
          {isConfirmed ? "Confirmada" : isPendingVerification || isPendingPayment ? "Pendiente" : "No encontrada"}
        </span>
        <h1 className="page-title text-2xl">{title}</h1>
        <p className="muted">{message}</p>
        {paymentInfo && (
          <div className="text-left bg-cream-50 rounded-[10px] p-4 space-y-1">
            <p className="field-label mb-1">Datos para tu transferencia</p>
            <p className="muted">Banco: {paymentInfo.banco}</p>
            <p className="muted">Titular: {paymentInfo.titular}</p>
            <p className="muted">CLABE: {paymentInfo.clabe}</p>
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-2">
          {user && (
            <a href="/mi-cuenta" className="btn-primary inline-flex">
              Ir a mi cuenta
            </a>
          )}
          <a href={`/${tenant}`} className="btn-ghost inline-flex">
            Volver al inicio
          </a>
        </div>
      </div>
    </main>
  );
}
