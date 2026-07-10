import { NextRequest, NextResponse } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

const ALLOWED_TYPES: EmailOtpType[] = ['email', 'signup', 'magiclink'];

// El error de magic link ocurre SIN sesión, así que NO puede caer en /mi-cuenta:
// esa ruta es protegida y el middleware rebota a /login (perdiendo ?link=error).
// Redirigimos a /{slug}/entrar?link=error (pública). Resolvemos el slug desde el
// tenant_id que A2 metió en el emailRedirectTo (query directo con service role,
// que bypassa RLS). Fallback a /login si el tenant no resuelve (borrado/inactivo).
async function errorRedirect(req: NextRequest, tenantId: string | null): Promise<NextResponse> {
  if (tenantId) {
    const admin = createAdminClient();
    const { data } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
    if (data?.slug) {
      return NextResponse.redirect(new URL(`/${data.slug}/entrar?link=error`, req.url));
    }
  }
  return NextResponse.redirect(new URL('/login', req.url));
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get('token_hash');
  const typeParam = (url.searchParams.get('type') ?? 'email') as EmailOtpType;
  const type: EmailOtpType = ALLOWED_TYPES.includes(typeParam) ? typeParam : 'email';
  const tenantId = url.searchParams.get('tenant_id');

  const supabase = await createClient();

  // 1) Canjear el token_hash por sesión (server-side, sin PKCE).
  if (!tokenHash) {
    return errorRedirect(req, tenantId);
  }
  const { error: otpError } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (otpError) {
    return errorRedirect(req, tenantId);
  }

  // 2) Vincular (tenant,email) -> auth_user_id: idempotente y anti-secuestro (A1).
  const { data: { user } } = await supabase.auth.getUser();
  if (tenantId && user?.email) {
    await supabase.rpc('link_patient_to_auth_user', {
      p_tenant_id: tenantId,
      p_email: user.email,
    });
    // Devuelve null si no había fila que ligar (o es de otro uid): redirigimos igual (privacidad).

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
      console.error('link-callback: vinculación de registros de evento falló', e);
    }
  }

  // 3) Sesión lista -> mi-cuenta. La UI (Sonnet) muestra saldo y citas.
  return NextResponse.redirect(new URL('/mi-cuenta', req.url));
}
