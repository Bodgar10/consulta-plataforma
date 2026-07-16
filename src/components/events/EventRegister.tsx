'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createClient } from '@/utils/supabase/client';
import { ConsentBox } from '@/components/legal/ConsentBox';
import EventRegisterConfirmation from './EventRegisterConfirmation';

type Props = {
  tenantId: string;
  tenantSlug: string;
  eventId: string;
  priceCents: number | null;
  isFull: boolean;
};

type Status = 'idle' | 'submitting' | 'confirmed_free' | 'error';

const ERROR_MESSAGES: Record<string, string> = {
  event_full: 'Justo se acabó el cupo. Intenta con otro evento o contáctanos.',
  event_unavailable: 'Este evento ya no está disponible.',
  connect_not_ready: 'No podemos procesar pagos en este momento. Intenta más tarde.',
  bad_request: 'Revisa tus datos e intenta de nuevo.',
  register_failed: 'No se pudo completar tu registro. Intenta de nuevo.',
};

export function EventRegister({ tenantId, tenantSlug, eventId, priceCents, isFull }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [acceptedConsent, setAcceptedConsent] = useState(false);
  const [wantsEventNotifications, setWantsEventNotifications] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
      const metaName = data.user?.user_metadata?.full_name;
      if (typeof metaName === 'string') setName(metaName);
    });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg(null);

    try {
      const res = await fetch('/api/events/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          event_id: eventId,
          email,
          name,
          wants_event_notifications: wantsEventNotifications,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const code = typeof data?.error === 'string' ? data.error : 'register_failed';
        throw new Error(ERROR_MESSAGES[code] ?? ERROR_MESSAGES.register_failed);
      }

      if (data.status === 'checkout' && data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      if (data.status === 'registered') {
        setStatus('confirmed_free');
        return;
      }

      throw new Error('Respuesta inesperada del servidor.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : ERROR_MESSAGES.register_failed);
      setStatus('error');
    }
  }

  if (status === 'confirmed_free') {
    return <EventRegisterConfirmation />;
  }

  if (isFull) {
    return (
      <div className="card text-center">
        <p className="text-body text-pine-700">Este evento ya no tiene cupo disponible.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="event-name" className="field-label">Nombre</label>
        <input id="event-name" value={name} onChange={(e) => setName(e.target.value)} type="text" required className="field" />
      </div>

      <div>
        <label htmlFor="event-email" className="field-label">Correo</label>
        <input id="event-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="field" autoComplete="email" />
      </div>

      {status === 'error' && errorMsg && <p className="field-error" role="alert">{errorMsg}</p>}

      <ConsentBox
        checked={acceptedConsent}
        onChange={setAcceptedConsent}
        tenantSlug={tenantSlug}
        variant="health"
        className="mb-4"
      />

      <label className="flex items-center gap-2 text-sm text-pine-700 mb-4">
        <input
          type="checkbox"
          checked={wantsEventNotifications}
          onChange={(e) => setWantsEventNotifications(e.target.checked)}
        />
        Avísame por correo cuando haya más talleres o cursos
      </label>
      <button type="submit" disabled={status === 'submitting' || !acceptedConsent} className="btn-primary w-full">
        {status === 'submitting' ? 'Procesando…' : priceCents ? 'Continuar al pago' : 'Reservar mi lugar'}
      </button>
    </form>
  );
}
