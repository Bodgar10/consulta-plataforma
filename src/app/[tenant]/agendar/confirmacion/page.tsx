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
  searchParams: Promise<{ payment_mode?: string }>;
}) {
  const { tenant } = await params;
  const { payment_mode: paymentMode } = await searchParams;
  const isTransfer = paymentMode === "transfer";
  const isCard = paymentMode === "card";
  const paymentInfo = isTransfer ? await getTenantPaymentInfo(tenant) : null;

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-16">
      <div className="card max-w-md w-full text-center space-y-4">
        <span className={isCard ? "badge-confirmed mx-auto" : "badge-pending mx-auto"}>
          {isCard ? "Pago confirmado" : "Pendiente de confirmación"}
        </span>
        <h1 className="page-title text-2xl">
          {isCard ? "¡Listo! Tu sesión está agendada" : "Revisa tu correo"}
        </h1>
        <p className="muted">
          {isCard
            ? "Te enviamos la confirmación con el enlace de tu sesión a tu correo."
            : "Te enviamos los siguientes pasos para completar tu pago y confirmar tu sesión. Si no lo ves en unos minutos, revisa spam."}
        </p>
        {isTransfer && paymentInfo && (
          <div className="text-left bg-cream-50 rounded-[10px] p-4 space-y-1">
            <p className="field-label mb-1">Datos para tu transferencia</p>
            <p className="muted">Banco: {paymentInfo.banco}</p>
            <p className="muted">Titular: {paymentInfo.titular}</p>
            <p className="muted">CLABE: {paymentInfo.clabe}</p>
          </div>
        )}
        <a href={`/${tenant}`} className="btn-ghost inline-flex mt-2">
          Volver al inicio
        </a>
      </div>
    </main>
  );
}
