'use client';

import { useEffect, useState } from 'react';

type State =
  | { status: 'idle'; timezone: null }
  | { status: 'loading'; timezone: null }
  | { status: 'ready'; timezone: string }
  | { status: 'error'; timezone: null };

/**
 * Consume GET /api/tenant/context?tenant_id= (Opus). Recibe tenantId como
 * argumento — NO lo resuelve solo (cada vista tiene su propia forma de
 * conseguirlo; ver C2 para el caso de /mi-cuenta). Si tenantId es null
 * (todavía no se resolvió del lado del caller), el hook se queda en 'idle'
 * sin disparar el fetch.
 */
export function useTenantTimezone(tenantId: string | null): State {
  const [state, setState] = useState<State>({ status: 'idle', timezone: null });

  useEffect(() => {
    if (!tenantId) {
      setState({ status: 'idle', timezone: null });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading', timezone: null });

    fetch(`/api/tenant/context?tenant_id=${encodeURIComponent(tenantId)}`)
      .then((res) => {
        if (!res.ok) throw new Error('tenant context fetch failed');
        return res.json();
      })
      .then((data: { timezone: string }) => {
        if (!cancelled) setState({ status: 'ready', timezone: data.timezone });
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', timezone: null });
      });

    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  return state;
}
