'use client';

import { useState, type FormEvent } from 'react';
import { ConsentBox } from '@/components/legal/ConsentBox';
import { readFirstTouchUTM } from './UTMPersistence';

type LeadMagnetPreview = { title: string; description: string | null } | null;

type Props = {
  tenantId: string;
  tenantSlug: string;
  landingSlug: string;
  leadMagnetPreview: LeadMagnetPreview;
};

type Status = 'idle' | 'submitting' | 'success' | 'error';

export function LeadCaptureForm({ tenantId, tenantSlug, landingSlug, leadMagnetPreview }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [magnetUrl, setMagnetUrl] = useState<string | null>(null);
  const [acceptedConsent, setAcceptedConsent] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg(null);

    const utm = readFirstTouchUTM();

    try {
      const res = await fetch('/api/leads/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: tenantId,
          landing_slug: landingSlug,
          email,
          name,
          phone: phone || undefined,
          utm_source: utm?.utm_source ?? undefined,
          utm_medium: utm?.utm_medium ?? undefined,
          utm_campaign: utm?.utm_campaign ?? undefined,
          utm_content: utm?.utm_content ?? undefined,
          utm_term: utm?.utm_term ?? undefined,
          referrer: utm?.referrer ?? undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error('No se pudo registrar tu correo. Intenta de nuevo.');
      }

      setMagnetUrl(typeof data.magnet_url === 'string' ? data.magnet_url : null);
      setStatus('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="card lead-magnet-card">
        <h3 className="card-title">Listo, revisa tu correo</h3>
        <p className="muted mt-1.5">
          Te enviamos la confirmación. {magnetUrl ? 'Aquí tienes tu descarga:' : ''}
        </p>
        {magnetUrl && (
          <a href={magnetUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 w-full">
            Descargar {leadMagnetPreview?.title ?? 'tu recurso'}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {leadMagnetPreview && (
        <div>
          <h3 className="card-title">{leadMagnetPreview.title}</h3>
          {leadMagnetPreview.description && <p className="muted mt-1">{leadMagnetPreview.description}</p>}
        </div>
      )}

      <div>
        <label htmlFor="name" className="field-label">Nombre</label>
        <input id="name" value={name} onChange={(e) => setName(e.target.value)} type="text" required className="field" />
      </div>

      <div>
        <label htmlFor="email" className="field-label">Correo</label>
        <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="field" autoComplete="email" />
      </div>

      <div>
        <label htmlFor="phone" className="field-label">Teléfono (opcional)</label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" className="field" />
      </div>

      {status === 'error' && errorMsg && <p className="field-error" role="alert">{errorMsg}</p>}

      <ConsentBox
        checked={acceptedConsent}
        onChange={setAcceptedConsent}
        tenantSlug={tenantSlug}
        variant="contact"
        className="mb-4"
      />
      <button type="submit" disabled={status === 'submitting' || !acceptedConsent} className="btn-primary w-full">
        {status === 'submitting' ? 'Enviando…' : 'Quiero recibirlo'}
      </button>
    </form>
  );
}
