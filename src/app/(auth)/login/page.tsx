'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resetOk, setResetOk] = useState(false);

  // Coordinado con C4: tras restablecer la contraseña se llega a /login?reset=ok.
  // Se lee del querystring en cliente (sin useSearchParams para no requerir Suspense).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('reset') === 'ok') {
      setResetOk(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('Correo o contraseña incorrectos.');
      setPending(false);
      return;
    }

    // Sincroniza la sesión con los Server Components y entra.
    router.refresh();
    router.push('/');
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-[420px] space-y-6">
        <div className="space-y-1.5">
          <h1 className="page-title">Inicia sesión</h1>
          <p className="muted">Entra a tu cuenta para continuar.</p>
        </div>

        {resetOk && (
          <p role="status" className="rounded-[7px] bg-success-50 text-pine-700 text-sm px-3 py-2.5">
            Tu contraseña se actualizó. Ya puedes iniciar sesión.
          </p>
        )}

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

          <div>
            <label htmlFor="password" className="field-label">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? 'Entrando…' : 'Iniciar sesión'}
          </button>

          <div className="text-right">
            <Link href="/recuperar" className="btn-ghost">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
        </form>

        <p className="muted text-center">
          ¿No tienes cuenta?{' '}
          <Link href="/registro" className="text-pine-700 font-medium hover:text-pine-600 transition-colors">
            Crea una
          </Link>
        </p>
      </div>
    </main>
  );
}
