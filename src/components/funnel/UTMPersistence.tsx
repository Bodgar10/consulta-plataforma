'use client';

import { useEffect } from 'react';

const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
] as const;

const STORAGE_KEY = 'first_touch_utm';

export type FirstTouchUTM = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  captured_at: string;
};

/**
 * Captura UTM de PRIMER TOQUE. Si ya existe un valor guardado, no lo pisa
 * (misma regla de negocio que public_capture_lead: la primera atribución manda).
 * No renderiza nada visible.
 *
 * Deliberadamente NO usa useSearchParams()/next/navigation — el proyecto evita
 * ese hook para no forzar un límite de Suspense (ver convención documentada en
 * src/app/(auth)/login/page.tsx). En su lugar, lee window.location.search
 * directo dentro del useEffect, que solo corre en cliente.
 */
export function UTMPersistence() {
  useEffect(() => {
    try {
      const existing = window.localStorage.getItem(STORAGE_KEY);
      if (existing) return;

      const params = new URLSearchParams(window.location.search);
      const hasAnyUTM = UTM_KEYS.some((key) => params.get(key));
      if (!hasAnyUTM) return;

      const payload: FirstTouchUTM = {
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
        utm_content: params.get('utm_content'),
        utm_term: params.get('utm_term'),
        referrer: document.referrer || null,
        captured_at: new Date().toISOString(),
      };

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // localStorage puede fallar (modo privado, cuotas). Fallar en silencio:
      // el UTM es "nice to have", nunca debe romper la navegación pública.
    }
  }, []);

  return null;
}

/** Helper de lectura para LeadCaptureForm y EventRegister. */
export function readFirstTouchUTM(): FirstTouchUTM | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FirstTouchUTM) : null;
  } catch {
    return null;
  }
}
