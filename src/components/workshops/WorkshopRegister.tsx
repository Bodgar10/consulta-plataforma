'use client';

import { useState, type FormEvent } from 'react';

type Props = {
  tenantId: string;
  tenantSlug: string;
  workshopId: string;
  priceCents: number | null;
};

type Status = 'idle' | 'submitting' | 'downloaded' | 'error';

export function WorkshopRegister({ tenantId, tenantSlug, workshopId, priceCents }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const isFree = !priceCents;

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');
    setErrorMsg(null);

    try {
      if (isFree) {
        const res = await fetch('/api/workshops/register-free', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tenant_id: tenantId, workshop_id: workshopId, email, name }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? 'No se pudo registrar tu descarga.');
        setDownloadUrl(data.download_url ?? null);
        setStatus('downloaded');
      } else {
        const res = await fetch('/api/workshops/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenant_id: tenantId,
            tenant_slug: tenantSlug,
            workshop_id: workshopId,
            email,
            name,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.checkout_url) throw new Error(data.message ?? 'No se pudo iniciar el pago.');
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ocurrió un error.');
      setStatus('error');
    }
  }

  if (status === 'downloaded') {
    return (
      <div className="card text-center">
        <h3 className="card-title">¡Listo! Ya es tuyo.</h3>
        <p className="muted mt-2">Te enviamos una copia a tu correo también.</p>
        {downloadUrl && (
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="btn-primary mt-4 inline-block">
            Descargar PDF
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="workshop-name" className="field-label">Nombre</label>
        <input id="workshop-name" value={name} onChange={(e) => setName(e.target.value)} type="text" required className="field" />
      </div>
      <div>
        <label htmlFor="workshop-email" className="field-label">Correo</label>
        <input id="workshop-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="field" autoComplete="email" />
      </div>

      {status === 'error' && errorMsg && <p className="field-error" role="alert">{errorMsg}</p>}

      <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full">
        {status === 'submitting' ? 'Procesando…' : isFree ? 'Descargar gratis' : 'Comprar y descargar'}
      </button>
    </form>
  );
}
