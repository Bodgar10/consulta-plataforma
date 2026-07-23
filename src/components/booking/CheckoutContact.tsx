"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import { ConsentBox } from "@/components/legal/ConsentBox";

export interface ContactPayload {
  full_name: string;
  email: string;
  phone: string;
  password?: string;
  payment_mode: "single" | "transfer" | "credit";
  accepted_consent: boolean;
  wants_event_notifications: boolean;
}

interface CreditContext {
  available: boolean;
  email: string;
  full_name: string | null;
  workshop_title: string;
}

interface CheckoutContactProps {
  onSubmit: (payload: ContactPayload) => Promise<void> | void;
  submitting?: boolean;
  errorMessage?: string | null;
  acceptsTransfer?: boolean;
  tenantId: string;
  tenantSlug: string;
  sessionPriceCents?: number | null;
  creditContext?: CreditContext | null;
}

function formatMXN(cents: number) {
  return (cents / 100).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });
}

export default function CheckoutContact({
  onSubmit,
  submitting = false,
  errorMessage = null,
  acceptsTransfer = false,
  tenantId,
  tenantSlug,
  sessionPriceCents,
  creditContext,
}: CheckoutContactProps) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [sessionContact, setSessionContact] = useState<{
    full_name: string;
    email: string;
    phone: string;
  } | null>(null);
  const [fullName, setFullName] = useState(creditContext?.full_name ?? "");
  const [email, setEmail] = useState(creditContext?.email ?? "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [wantsAccount, setWantsAccount] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"single" | "transfer">("single");
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [wantsEventNotifications, setWantsEventNotifications] = useState(false);

  // Revisa sesión existente para saltar la captura de contacto (login NO forzoso).
  // Si hay sesión, precarga los datos de contacto desde `patients` (bajo RLS de
  // paciente, current_user_patient_ids()) para no mandar strings vacíos a
  // /api/booking/create.
  useState(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data }) => {
      const user = data.user;
      setHasSession(!!user);
      if (user) {
        const { data: patient } = await supabase
          .from("patients")
          .select("full_name, email, phone")
          .eq("tenant_id", tenantId)
          .eq("auth_user_id", user.id)
          .maybeSingle();
        // full_name cae al metadata del propio usuario (raw_user_meta_data,
        // que el registro llena en el signUp) cuando la fila de patients no es
        // visible — p.ej. cuenta con auth_user_id sin vincular, que la RLS de
        // patients_self_select oculta. Evita mandar full_name vacío -> 400.
        setSessionContact({
          full_name: patient?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? "",
          email: patient?.email ?? user.email ?? "",
          phone: patient?.phone ?? "",
        });
      }
    });
  });

  if (hasSession === null) {
    return <p className="muted">Cargando...</p>;
  }

  const priceNotice = sessionPriceCents ? (
    <p className="text-pine-700 font-medium tabular-nums">
      Costo de la sesión: {formatMXN(sessionPriceCents)}
    </p>
  ) : null;

  const paymentModeSelector = acceptsTransfer ? (
    <div className="space-y-2">
      {priceNotice}
      <span className="field-label">Forma de pago</span>
      <div className="flex gap-3">
        <label className="flex items-center gap-2 text-sm text-pine-700">
          <input
            type="radio"
            name="payment_mode"
            checked={paymentMode === "single"}
            onChange={() => setPaymentMode("single")}
          />
          Pago con tarjeta
        </label>
        <label className="flex items-center gap-2 text-sm text-pine-700">
          <input
            type="radio"
            name="payment_mode"
            checked={paymentMode === "transfer"}
            onChange={() => setPaymentMode("transfer")}
          />
          Transferencia
        </label>
      </div>
    </div>
  ) : null;

  const consentCheckbox = (
    <ConsentBox
      checked={acceptedConsent}
      onChange={setAcceptedConsent}
      tenantSlug={tenantSlug}
      variant="health"
    />
  );

  const eventNotificationsCheckbox = (
    <label className="flex items-center gap-2 text-sm text-pine-700">
      <input
        type="checkbox"
        checked={wantsEventNotifications}
        onChange={(e) => setWantsEventNotifications(e.target.checked)}
      />
      Avísame por correo cuando haya talleres o cursos nuevos
    </label>
  );

  if (creditContext) {
    const handleCreditSubmit = async (e: FormEvent) => {
      e.preventDefault();
      await onSubmit({
        full_name: fullName,
        email,
        phone: "",
        payment_mode: "credit",
        accepted_consent: acceptedConsent,
        wants_event_notifications: false,
      });
    };

    return (
      <form onSubmit={handleCreditSubmit} className="card space-y-4">
        <h3 className="card-title">Tu sesión gratis</h3>
        <p className="muted">
          Vas a usar la sesión gratis de <strong>{creditContext.workshop_title}</strong>.
        </p>

        <div>
          <label className="field-label" htmlFor="credit-full-name">Nombre completo</label>
          <input
            id="credit-full-name"
            className="field"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="credit-email">Correo (el mismo con el que compraste el taller)</label>
          <input
            id="credit-email"
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {consentCheckbox}

        {errorMessage && <p className="field-error">{errorMessage}</p>}

        <button type="submit" className="btn-primary w-full" disabled={submitting || !acceptedConsent}>
          {submitting ? "Procesando..." : "Confirmar mi cita gratis"}
        </button>
      </form>
    );
  }

  if (hasSession) {
    return (
      <div className="card space-y-4">
        <p className="muted">Ya tienes una cuenta. Continúa para confirmar tu cita.</p>
        {paymentModeSelector}
        {consentCheckbox}
        {eventNotificationsCheckbox}
        <button
          className="btn-primary w-full"
          disabled={submitting || !acceptedConsent}
          onClick={() =>
            onSubmit({
              full_name: sessionContact?.full_name ?? "",
              email: sessionContact?.email ?? "",
              phone: sessionContact?.phone ?? "",
              payment_mode: paymentMode,
              accepted_consent: acceptedConsent,
              wants_event_notifications: wantsEventNotifications,
            })
          }
        >
          {submitting ? "Procesando..." : "Continuar"}
        </button>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    await onSubmit({
      full_name: fullName,
      email,
      phone,
      password: wantsAccount && password ? password : undefined,
      payment_mode: paymentMode,
      accepted_consent: acceptedConsent,
      wants_event_notifications: wantsEventNotifications,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      <h3 className="card-title">Tus datos de contacto</h3>

      <div>
        <label className="field-label" htmlFor="full_name">Nombre completo</label>
        <input
          id="full_name"
          className="field"
          type="text"
          required
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="email">Correo</label>
        <input
          id="email"
          className="field"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="field-label" htmlFor="phone">Teléfono</label>
        <input
          id="phone"
          className="field"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div className="pt-1">
        <label className="flex items-center gap-2 text-sm text-pine-700">
          <input
            type="checkbox"
            checked={wantsAccount}
            onChange={(e) => setWantsAccount(e.target.checked)}
          />
          Quiero crear una cuenta para gestionar mis citas
        </label>
      </div>

      {wantsAccount && (
        <div>
          <label className="field-label" htmlFor="password">Contraseña</label>
          <input
            id="password"
            className="field"
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      {paymentModeSelector}
      {consentCheckbox}
      {eventNotificationsCheckbox}

      {errorMessage && <p className="field-error">{errorMessage}</p>}

      <button
        type="submit"
        className="btn-primary w-full"
        disabled={submitting || !acceptedConsent}
      >
        {submitting ? "Procesando..." : "Continuar a pago"}
      </button>
    </form>
  );
}
