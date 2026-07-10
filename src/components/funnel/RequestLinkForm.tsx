'use client';

import { useState, type FormEvent } from 'react';

type Props = { tenantId: string };
type Status = 'idle' | 'submitting' | 'sent';

export function RequestLinkForm({ tenantId }: Props) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('submitting');

    try {
      await fetch('/api/patient/request-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenant_id: tenantId, email }),
      });
    } catch {
      // Mismo copy neutro incluso si la red falla — nunca distinguimos.
    }
    setStatus('sent');
  }

  if (status === 'sent') {
    return (
      <div className="card max-w-sm w-full text-center">
        <h1 className="card-title">Revisa tu correo</h1>
        <p className="muted mt-2">
          Si tu correo está registrado, te enviamos un enlace para entrar a tu cuenta.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card max-w-sm w-full space-y-4">
      <div>
        <h1 className="page-title">Entrar a mi cuenta</h1>
        <p className="muted mt-1.5">Te enviamos un enlace de acceso, sin contraseña.</p>
      </div>

      <div>
        <label htmlFor="entrar-email" className="field-label">Correo</label>
        <input
          id="entrar-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
          className="field"
          autoComplete="email"
        />
      </div>

      <button type="submit" disabled={status === 'submitting'} className="btn-primary w-full">
        {status === 'submitting' ? 'Enviando…' : 'Enviarme el enlace'}
      </button>
    </form>
  );
}
