'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function TenantRegistroPage() {
  const params = useParams<{ tenant: string }>();
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Caso ESPERADO (no error): con confirmación de correo activa, signUp no deja
  // sesión, así que el paso 3 falla con 'sin sesión'. El paciente se vincula
  // solito al confirmar el correo (link-callback + migración 042).
  const [emailConfirmSent, setEmailConfirmSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }

    setPending(true);
    const supabase = createClient();

    // 1) Resuelve el tenant real desde el slug de la URL. Va ANTES del signUp
    // porque su id se necesita para armar el emailRedirectTo, y porque así no
    // queda una cuenta de auth huérfana si el slug no resuelve.
    const { data: tenant } = await supabase
      .rpc('public_get_tenant_by_slug', { p_slug: params.tenant })
      .maybeSingle();

    if (!tenant?.id) {
      setError('No pudimos identificar la consulta. Intenta de nuevo.');
      setPending(false);
      return;
    }

    // 2) Crea la cuenta de auth. El correo de confirmación apunta a link-callback
    // (maneja token_hash de tipo 'signup' y vincula al paciente), con la base
    // anclada a NEXT_PUBLIC_APP_URL en vez del Site URL del dashboard.
    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${base}/api/patient/link-callback?tenant_id=${tenant.id}`,
        data: {
          full_name: fullName.trim(),
        },
      },
    });

    if (signUpError) {
      setError('No se pudo crear la cuenta. Verifica el correo e inténtalo de nuevo.');
      setPending(false);
      return;
    }

    // 3) Crea o vincula la fila de paciente — funciona con o sin citas previas.
    const { error: ensureError } = await supabase.rpc('public_ensure_patient_account', {
      p_tenant_id: tenant.id,
      p_email: email.trim(),
      p_full_name: fullName.trim(),
      // La función acepta null (columna nullable); el cast preserva el null en
      // runtime, igual que el patrón de public_capture_lead.
      p_phone: (phone.trim() || null) as string,
    });

    if (ensureError) {
      // 'sin sesión' = confirmación de correo activa: el registro SÍ funcionó,
      // solo falta que el usuario confirme su correo para completar el enlace.
      // No es un error real -> pantalla de "revisa tu correo".
      if ((ensureError.message ?? '').includes('sin sesión')) {
        setEmailConfirmSent(true);
        setPending(false);
        return;
      }
      // Cualquier OTRO error de la RPC sí es un fallo genuino.
      setError('Tu cuenta se creó, pero hubo un problema al vincularla. Contáctanos.');
      setPending(false);
      return;
    }

    router.refresh();
    router.push('/mi-cuenta');
  }

  // Pantalla de éxito: registro correcto, solo falta confirmar el correo.
  if (emailConfirmSent) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4 py-12">
        <div className="card w-full max-w-[420px] space-y-4 text-center">
          <h1 className="page-title">Revisa tu correo</h1>
          <p className="muted">
            Te enviamos un enlace a <span className="text-pine-700 font-medium">{email}</span>.
            Al confirmarlo, tu cuenta quedará lista.
          </p>
          <p className="muted">Si no lo ves en unos minutos, revisa tu carpeta de spam.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-[420px] space-y-6">
        <div className="space-y-1.5">
          <h1 className="page-title">Crea tu cuenta</h1>
          <p className="muted">Para ver tus citas y reservar más adelante.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="full_name" className="field-label">Nombre completo</label>
            <input
              id="full_name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="email" className="field-label">Correo electrónico</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="phone" className="field-label">Teléfono (opcional)</label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="field"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">Contraseña</label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? 'Creando…' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </main>
  );
}
