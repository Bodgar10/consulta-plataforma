'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function RecuperarPage() {
  const [email, setEmail] = useState('');
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/nueva-contrasena`,
      });
      if (resetError) {
        setError('No pudimos enviar el correo. Verifica que el email sea correcto.');
      } else {
        setSent(true);
      }
    } catch {
      setError('Ocurrió un error. Intenta de nuevo.');
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-[420px] space-y-6">
        {!sent ? (
          <>
            <div className="space-y-1.5">
              <h1 className="page-title">Recuperar contraseña</h1>
              <p className="muted">
                Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className="field-label">
                  Correo electrónico
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field"
                  placeholder="tu@correo.com"
                />
              </div>

              {error && (
                <p role="alert" className="field-error">
                  {error}
                </p>
              )}

              <button type="submit" disabled={pending} className="btn-primary w-full">
                {pending ? 'Enviando…' : 'Enviar enlace de recuperación'}
              </button>
            </form>
          </>
        ) : (
          <div className="space-y-4 text-center">
            <h1 className="page-title">Revisa tu correo</h1>
            <p className="muted">
              Enviamos un enlace a <span className="text-pine-700 font-medium">{email}</span>.
              Úsalo para crear tu nueva contraseña. Revisa tu carpeta de spam si no lo ves.
            </p>
          </div>
        )}

        <div className="text-center">
          <Link href="/login" className="btn-ghost">
            ← Volver a inicio de sesión
          </Link>
        </div>
      </div>
    </main>
  );
}
