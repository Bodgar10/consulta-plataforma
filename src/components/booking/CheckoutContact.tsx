"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/utils/supabase/client";
import { ConsentBox } from "@/components/legal/ConsentBox";

export interface ContactPayload {
  full_name: string;
  email: string;
  phone: string;
  password?: string;
  payment_mode: "single" | "transfer";
  accepted_consent: boolean;
}

interface CheckoutContactProps {
  onSubmit: (payload: ContactPayload) => Promise<void> | void;
  submitting?: boolean;
  errorMessage?: string | null;
  acceptsTransfer?: boolean;
  tenantId: string;
  tenantSlug: string;
}

export default function CheckoutContact({
  onSubmit,
  submitting = false,
  errorMessage = null,
  acceptsTransfer = false,
  tenantId,
  tenantSlug,
}: CheckoutContactProps) {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [sessionContact, setSessionContact] = useState<{
    full_name: string;
    email: string;
    phone: string;
  } | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [wantsAccount, setWantsAccount] = useState(false);
  const [paymentMode, setPaymentMode] = useState<"single" | "transfer">("single");
  const [acceptedConsent, setAcceptedConsent] = useState(false);

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
        setSessionContact({
          full_name: patient?.full_name ?? "",
          email: patient?.email ?? user.email ?? "",
          phone: patient?.phone ?? "",
        });
      }
    });
  });

  if (hasSession === null) {
    return <p className="muted">Cargando...</p>;
  }

  const paymentModeSelector = acceptsTransfer ? (
    <div className="space-y-2">
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

  if (hasSession) {
    return (
      <div className="card space-y-4">
        <p className="muted">Ya tienes una cuenta. Continúa para confirmar tu cita.</p>
        {paymentModeSelector}
        {consentCheckbox}
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
