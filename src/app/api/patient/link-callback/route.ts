import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/patient/link-callback?token_hash=...&type=...&tenant_id=...
// Es el `emailRedirectTo` del correo de confirmación. Los escáneres de correo
// (Outlook Safe Links, etc.) pre-visitan este GET automáticamente, así que YA
// NO consume el token aquí (eso quemaba el token antes del clic real). En vez
// de eso, redirige a la interstitial /{slug}/confirmar-cuenta, donde la
// confirmación es una acción EXPLÍCITA del usuario (POST desde un botón, que
// los escáneres no disparan). El token viaja intacto en la query.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') ?? 'email';
  const tenantId = url.searchParams.get('tenant_id');

  // Sin token no hay nada que confirmar: a login.
  if (!tokenHash) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // Resolver el slug del tenant (service role, bypassa RLS) para la interstitial.
  let slug: string | null = null;
  if (tenantId) {
    const admin = createAdminClient();
    const { data } = await admin.from('tenants').select('slug').eq('id', tenantId).maybeSingle();
    slug = data?.slug ?? null;
  }
  if (!slug) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  const target = new URL(`/${slug}/confirmar-cuenta`, req.url);
  target.searchParams.set('token_hash', tokenHash);
  target.searchParams.set('type', type);
  if (tenantId) target.searchParams.set('tenant_id', tenantId);
  return NextResponse.redirect(target);
}
