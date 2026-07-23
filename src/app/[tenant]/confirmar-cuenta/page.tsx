'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';

// Interstitial de confirmación de cuenta. El correo apunta aquí (vía
// link-callback) en vez de consumir el token directo, porque los escáneres de
// correo pre-visitan el link y quemarían el token antes del clic real. La
// confirmación ocurre en un POST explícito (botón) que los escáneres no
// disparan. El token_hash llega en la query y se manda al endpoint al hacer clic.
export default function ConfirmarCuentaPage() {
  const params = useParams<{ tenant: string }>();
  const router = useRouter();
  const [tokenHash, setTokenHash] = useState<string | null>(null);
  const [type, setType] = useState('email');
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setTokenHash(sp.get('token_hash'));
    setType(sp.get('type') ?? 'email');
    setTenantId(sp.get('tenant_id'));
  }, []);

  async function handleConfirm() {
    setPending(true);
    setError(false);
    try {
      const res = await fetch('/api/patient/confirm-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, type, tenant_id: tenantId }),
      });
      if (!res.ok) {
        setError(true);
        setPending(false);
        return;
      }
      router.refresh();
      router.push('/mi-cuenta');
    } catch {
      setError(true);
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card w-full max-w-[420px] space-y-6 text-center">
        {error ? (
          <>
            <h1 className="page-title">No pudimos confirmar tu cuenta</h1>
            <p className="muted">
              Tu enlace de acceso ya no es válido. Puede que haya expirado o que ya se
              haya usado. Pide uno nuevo para entrar.
            </p>
            <Link href={`/${params.tenant}/entrar`} className="btn-secondary w-full">
              Pedir un enlace nuevo
            </Link>
          </>
        ) : (
          <>
            <h1 className="page-title">Confirma tu cuenta</h1>
            <p className="muted">Da clic en el botón para activar tu cuenta y entrar.</p>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={pending || !tokenHash}
              className="btn-primary w-full"
            >
              {pending ? 'Confirmando…' : 'Confirmar mi cuenta'}
            </button>
          </>
        )}
      </div>
    </main>
  );
}
