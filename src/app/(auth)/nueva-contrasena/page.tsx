'use client';

// Patrón de confirmación (declarado por el prompt C4):
// tras updateUser({ password }) exitoso, redirigimos a /login?reset=ok.
// La página de login (C1) lee ?reset=ok y muestra un aviso de éxito.
// Se elige el query param por ser el patrón más simple (sin estado global ni storage).

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function NuevaContrasenaPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setPending(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError('No pudimos actualizar la contraseña. El enlace puede haber expirado.');
      } else {
        setDone(true);
        router.push('/login?reset=ok');
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
        <div className="space-y-1.5">
          <h1 className="page-title">Nueva contraseña</h1>
          <p className="muted">Elige una contraseña segura para tu cuenta.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="field-label">
              Nueva contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="field-label">
              Confirmar contraseña
            </label>
            <input
              id="confirm"
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="field"
              placeholder="Repite tu contraseña"
            />
          </div>

          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={pending || done} className="btn-primary w-full">
            {pending ? 'Guardando…' : done ? 'Contraseña actualizada' : 'Guardar nueva contraseña'}
          </button>
        </form>
      </div>
    </main>
  );
}
