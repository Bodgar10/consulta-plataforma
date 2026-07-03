'use client';

// ⚠️ ESTE NO ES EL FLUJO PRIMARIO DEL PACIENTE.
// El paciente nace ANÓNIMO desde el booking (carril Opus: public_create_appointment
// crea patient sin auth_user_id, y link-account lo vincula si pone contraseña).
// Este /registro existe SOLO para:
//   (a) la profesional dueña del tenant en su setup inicial, o
//   (b) un paciente que decide crear cuenta DESPUÉS de ya tener citas (caso borde).
// NO reusar como alta principal de pacientes ni crear aquí filas de
// perfil/paciente/tenant_member: este archivo solo hace supabase.auth.signUp().

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

export default function RegistroPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setPending(true);
    const supabase = createClient();
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (signUpError) {
      setError('No se pudo crear la cuenta. Verifica el correo e inténtalo de nuevo.');
      setPending(false);
      return;
    }

    setEmailSent(true);
    setPending(false);
  }

  // Pantalla de verificación de correo.
  if (emailSent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="card w-full max-w-[420px] space-y-4 text-center">
          <h1 className="page-title">Revisa tu correo</h1>
          <p className="muted">
            Te enviamos un enlace de verificación a <span className="text-pine-700 font-medium">{email}</span>.
          </p>
          <p className="muted">
            Haz clic en el enlace para activar tu cuenta. Revisa también tu carpeta de spam
            si no lo ves en unos minutos.
          </p>
          <Link href="/login" className="btn-secondary w-full">
            Volver a inicio de sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-[420px] space-y-6">
        <div className="space-y-1.5">
          <h1 className="page-title">Crea tu cuenta</h1>
          <p className="muted">Regístrate con tu correo y una contraseña.</p>
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

          <div>
            <label htmlFor="password" className="field-label">
              Contraseña
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

          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="muted text-center">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-pine-700 font-medium hover:text-pine-600 transition-colors">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
