import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES: EmailOtpType[] = ['email', 'signup', 'magiclink'];

// Resuelve el slug del tenant para el redirect de error (mismo criterio que el
// GET link-callback: query directo con service role, que bypassa RLS).
async function errorTarget(tenantId: string | null): Promise<string> {
  if (tenantId) {
    const admin = createAdminClient();
    const { data } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
    if (data?.slug) return `/${data.slug}/entrar?link=error`;
  }
  return '/login';
}

// POST /api/patient/confirm-account
// Confirmación de cuenta como ACCIÓN EXPLÍCITA (no un GET automático): los
// escáneres de correo (Outlook Safe Links, etc.) pre-visitan URLs y consumirían
// el token_hash antes del clic real del usuario. Un POST desde un botón no lo
// disparan los escáneres. Consume el token con verifyOtp, vincula el paciente
// (idempotente, anti-secuestro) y responde JSON — la sesión queda en cookies.
export async function POST(req: NextRequest) {
  let tokenHash = '', typeRaw = 'email', tenantId: string | null = null;
  try {
    const b = await req.json();
    tokenHash = String(b?.token_hash ?? '');
    typeRaw = String(b?.type ?? 'email');
    tenantId = b?.tenant_id ? String(b.tenant_id) : null;
  } catch {
    return NextResponse.json({ ok: false, redirectTo: await errorTarget(null) }, { status: 400 });
  }

  const type: EmailOtpType = ALLOWED_TYPES.includes(typeRaw as EmailOtpType)
    ? (typeRaw as EmailOtpType)
    : 'email';

  if (!tokenHash) {
    return NextResponse.json({ ok: false, redirectTo: await errorTarget(tenantId) }, { status: 400 });
  }

  const supabase = await createClient();

  // 1) Canjear el token_hash por sesión (server-side, sin PKCE). Set-Cookie de
  // la sesión viaja en la respuesta de este POST.
  const { error: otpError } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (otpError) {
    return NextResponse.json({ ok: false, redirectTo: await errorTarget(tenantId) }, { status: 400 });
  }

  // 2) Vincular (tenant,email) -> auth_user_id: idempotente y anti-secuestro (A1).
  const { data: { user } } = await supabase.auth.getUser();
  if (tenantId && user?.email) {
    const { data: linkedPatientId, error: linkError } = await supabase.rpc('link_patient_to_auth_user', {
      p_tenant_id: tenantId,
      p_email: user.email,
    });
    // Devuelve null si no había fila que ligar (o es de otro uid): seguimos igual (privacidad).
    // Trazabilidad: en Vercel esto confirma si el link efectivamente vinculó/creó
    // la fila. `linkedPatientId` null SIN error = no había nada que ligar y el
    // INSERT (042) no aplicó o chocó por conflicto; con error = la RPC lanzó.
    if (linkError) {
      console.error('confirm-account: link_patient_to_auth_user error', tenantId, user.email, linkError.message);
    } else {
      console.log('confirm-account: link_patient_to_auth_user ok', tenantId, user.email, 'patient_id=', linkedPatientId ?? 'null');
    }

    // Vincula retroactivamente los registros a evento hechos con este correo ANTES
    // de loguearse (son email-only, nunca traen auth_user_id al crearse). Idempotente:
    // solo toca filas con auth_user_id null. No crítico: si falla, no rompe el login.
    // Match por `=` con email normalizado a minúsculas (los registros se guardan con
    // lower()); NO ilike, porque `_` en un correo (p.ej. bodgar_jair@) es comodín y
    // haría match de más.
    try {
      const admin = createAdminClient();
      await admin
        .from('live_event_registrations')
        .update({ auth_user_id: user.id })
        .eq('tenant_id', tenantId)
        .eq('email', user.email.toLowerCase())
        .is('auth_user_id', null);
    } catch (e) {
      console.error('confirm-account: vinculación de registros de evento falló', e);
    }
  }

  // 3) Sesión lista. El cliente navega a /mi-cuenta tras recibir ok.
  return NextResponse.json({ ok: true });
}
