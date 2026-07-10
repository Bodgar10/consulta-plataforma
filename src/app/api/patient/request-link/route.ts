import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

// Rate-limit best-effort en memoria (el límite real es el de Supabase Auth por email).
const HITS = new Map<string, { n: number; ts: number }>();
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 5;
function rateLimited(key: string): boolean {
  const now = Date.now();
  const cur = HITS.get(key);
  if (!cur || now - cur.ts > WINDOW_MS) { HITS.set(key, { n: 1, ts: now }); return false; }
  cur.n += 1; return cur.n > MAX_PER_WINDOW;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  let email = '', tenantId = '';
  try {
    const b = await req.json();
    email = String(b?.email ?? '').trim().toLowerCase();
    tenantId = String(b?.tenant_id ?? '');
  } catch {
    return NextResponse.json({ ok: true }, { status: 202 });
  }

  // Respuesta genérica SIEMPRE (privacidad): no revelamos si el correo existe.
  const generic = NextResponse.json({ ok: true }, { status: 202 });

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
  if (!emailOk || !tenantId) return generic;
  if (rateLimited(`${ip}:${tenantId}:${email}`)) return generic;

  // ¿Hay paciente para (tenant, email)? Solo entonces disparamos el OTP. (service role)
  const admin = createAdminClient();
  const { data: exists } = await admin.rpc('patient_exists_for_login', {
    p_tenant_id: tenantId,
    p_email: email,
  });

  if (exists === true) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const supabase = await createClient();
    // shouldCreateUser: true — el auth user se crea y A3 lo vincula. tenant_id viaja en el redirect.
    await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${base}/api/patient/link-callback?tenant_id=${tenantId}`,
      },
    });
  }

  return generic;
}
