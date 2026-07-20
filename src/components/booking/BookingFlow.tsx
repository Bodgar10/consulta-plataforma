'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import SlotPicker, { type Slot } from './SlotPicker';
import CheckoutContact, { type ContactPayload } from './CheckoutContact';

// La ruta GET /api/booking/availability (carril Opus) devuelve slots planos en UTC.
interface ApiSlot {
  start: string; // ISO UTC
  end: string;   // ISO UTC
}

interface CreditInfo {
  available: boolean;
  email: string;
  full_name: string | null;
  workshop_title: string;
}

interface BookingFlowProps {
  tenantId: string;
  tenantSlug: string;
  tenantTimezone: string;
  acceptsTransfer?: boolean;
  sessionPriceCents?: number | null;
  creditInfo?: CreditInfo | null;
}

// Ventana de disponibilidad que pedimos; el endpoint la recorta por lead-time/horizonte.
const HORIZON_DAYS = 45;

export default function BookingFlow({ tenantId, tenantSlug, tenantTimezone, acceptsTransfer, sessionPriceCents, creditInfo }: BookingFlowProps) {
  const router = useRouter();

  const [slotsByDay, setSlotsByDay] = useState<Record<string, Slot[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Agrupa los slots planos por día (hora local del tenant). start_at/end_at se
  // conservan en UTC real (lo que el backend espera al crear la cita); SlotPicker
  // los muestra en hora local del visitante (MVP mono-zona: coincide con el tenant).
  const groupByDay = useCallback(
    (apiSlots: ApiSlot[]): Record<string, Slot[]> => {
      const grouped: Record<string, Slot[]> = {};
      for (const s of apiSlots) {
        const dayKey = DateTime.fromISO(s.start, { zone: 'utc' })
          .setZone(tenantTimezone)
          .toFormat('yyyy-MM-dd');
        (grouped[dayKey] ??= []).push({ start_at: s.start, end_at: s.end, available: true });
      }
      return grouped;
    },
    [tenantTimezone],
  );

  const fetchAvailability = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const from = new Date().toISOString();
      const to = new Date(Date.now() + HORIZON_DAYS * 24 * 60 * 60 * 1000).toISOString();
      const res = await fetch(
        `/api/booking/availability?tenant_id=${encodeURIComponent(tenantId)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      if (!res.ok) throw new Error('availability');
      const data = (await res.json()) as { slots: ApiSlot[] };
      setSlotsByDay(groupByDay(data.slots ?? []));
    } catch {
      setLoadError('No pudimos cargar los horarios disponibles. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tenantId, groupByDay]);

  useEffect(() => {
    fetchAvailability();
  }, [fetchAvailability]);

  async function handleContactSubmit(values: ContactPayload) {
    if (!selectedSlot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/booking/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          tenant_slug: tenantSlug,
          start_at: selectedSlot.start_at,
          end_at: selectedSlot.end_at,
          full_name: values.full_name,
          email: values.email,
          phone: values.phone,
          password: values.password || undefined,
          // El modo lo elige el paciente en CheckoutContact (single/transfer);
          // si el tenant no acepta transferencia, el selector no aparece y queda 'single'.
          payment_mode: values.payment_mode,
          // privacy_version la ancla el servidor (Opus O-B3); el cliente ya no la envía.
          consent: { accepted: values.accepted_consent },
          wants_event_notifications: values.wants_event_notifications,
        }),
      });

      const data = (await res.json()) as {
        checkout_url?: string;
        status?: string;
        appointment_id?: string;
        error?: string;
        message?: string;
      };

      if (!res.ok) {
        // Conflicto de slot u otro error de negocio: muestra el mensaje y refresca slots.
        setSubmitError(
          data.error === 'slot_unavailable'
            ? 'El horario ya no está disponible. Elige otro, por favor.'
            : data.message ?? 'No se pudo crear la reserva. Intenta de nuevo.',
        );
        setSubmitting(false);
        if (data.error === 'slot_unavailable') {
          setSelectedSlot(null);
          await fetchAvailability();
        }
        return;
      }

      // La ruta de Opus responde por modo: card/oxxo → {checkout_url} (Stripe);
      // credit/transfer → {status}. Redirigimos a Stripe si aplica; si no, a confirmación.
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      router.push(`/${tenantSlug}/agendar/confirmacion?appt=${data.appointment_id}`);
    } catch {
      setSubmitError('Ocurrió un error. Intenta de nuevo.');
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="muted">Cargando horarios disponibles…</p>;
  }

  if (loadError) {
    return (
      <div className="card space-y-4">
        <p className="muted">{loadError}</p>
        <button className="btn-secondary" onClick={fetchAvailability}>
          Reintentar
        </button>
      </div>
    );
  }

  if (selectedSlot) {
    const local = DateTime.fromISO(selectedSlot.start_at, { zone: 'utc' })
      .setZone(tenantTimezone)
      .setLocale('es');
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="muted">
            Horario elegido:{' '}
            <span className="text-pine-700 font-medium">{local.toFormat("cccc d 'de' LLLL, HH:mm")}</span>
          </p>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setSubmitError(null);
              setSelectedSlot(null);
            }}
          >
            ← Cambiar horario
          </button>
        </div>
        <CheckoutContact
          onSubmit={handleContactSubmit}
          submitting={submitting}
          errorMessage={submitError}
          acceptsTransfer={acceptsTransfer}
          tenantId={tenantId}
          tenantSlug={tenantSlug}
          sessionPriceCents={sessionPriceCents}
          creditContext={creditInfo?.available ? creditInfo : null}
        />
      </div>
    );
  }

  return (
    <>
      {creditInfo && !creditInfo.available && (
        <div className="card mb-4">
          <p className="text-sm text-pine-700">
            El enlace de sesión gratis de <strong>{creditInfo.workshop_title}</strong> ya fue usado o ya no está disponible. Puedes agendar normalmente aquí abajo.
          </p>
        </div>
      )}
      <SlotPicker
        slotsByDay={slotsByDay}
        selectedSlot={selectedSlot}
        onSelectSlot={(slot) => {
          setSubmitError(null);
          setSelectedSlot(slot);
        }}
        tenantTimezone={tenantTimezone}
      />
    </>
  );
}
