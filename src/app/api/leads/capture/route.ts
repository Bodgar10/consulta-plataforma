import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let b: any = {};
  try { b = await req.json(); } catch { return NextResponse.json({ error: 'bad_request' }, { status: 400 }); }

  const tenantId = String(b?.tenant_id ?? '');
  const email = String(b?.email ?? '').trim().toLowerCase();
  const name = b?.name ? String(b.name).trim() : null;
  const phone = b?.phone ? String(b.phone).trim() : null;
  const landingSlug = b?.landing_slug ? String(b.landing_slug) : null;

  if (!tenantId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Resolver landing + su magnet server-side (fuente de verdad de lo publicado).
  let landingPageId: string | null = b?.landing_page_id ? String(b.landing_page_id) : null;
  let magnetId: string | null = null;
  let magnetUrl: string | null = null;

  if (landingSlug) {
    const { data: landing } = await supabase.rpc('public_get_landing', {
      p_tenant_id: tenantId, p_slug: landingSlug,
    });
    if (landing) {
      landingPageId = (landing as { id?: string }).id ?? landingPageId;
      const lm = (landing as { lead_magnet?: { id?: string; file_url?: string } }).lead_magnet;
      if (lm) { magnetId = lm.id ?? null; magnetUrl = lm.file_url ?? null; }
    }
  }

  // Captura del lead — 12 args exactos (primera atribución UTM manda; upsert por tenant+email).
  // Los tipos generados marcan cada arg como string; el cast `as string` preserva el null en runtime
  // (los params de la función SQL son nullables), igual que el patrón de public_record_consent.
  const { data, error } = await supabase.rpc('public_capture_lead', {
    p_tenant_id: tenantId,
    p_email: email,
    p_name: name as string,
    p_phone: phone as string,
    p_landing_page_id: landingPageId as string,
    p_lead_magnet_id: magnetId as string,
    p_utm_source: b?.utm_source ?? null,
    p_utm_medium: b?.utm_medium ?? null,
    p_utm_campaign: b?.utm_campaign ?? null,
    p_utm_content: b?.utm_content ?? null,
    p_utm_term: b?.utm_term ?? null,
    p_referrer: b?.referrer ?? null,
  });
  if (error) {
    return NextResponse.json({ error: 'capture_failed' }, { status: 400 });
  }

  const leadId = data as string;

  // Consentimiento de CONTACTO (nivel lead, no salud): evidencia best-effort.
  const { data: legalDoc } = await supabase.rpc('public_get_legal_document', {
    p_tenant_id: tenantId,
    p_doc_type: 'privacy',
  });
  const serverPrivacyVersion = (legalDoc as { version?: string } | null)?.version;
  if (serverPrivacyVersion) {
    const fwd = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';
    const ip = fwd.split(',')[0]?.trim() || null;
    const ua = req.headers.get('user-agent') ?? null;
    try {
      await supabase.rpc('public_record_lead_consent', {
        p_lead_id: leadId,
        p_privacy_version: serverPrivacyVersion,
        // La función acepta null (columnas nullables); el cast preserva el null
        // en runtime, igual que el patrón de public_capture_lead / booking.
        p_ip: ip as string,
        p_user_agent: ua as string,
      });
    } catch (e) {
      console.error('record_lead_consent best-effort failed', e);
    }
  }

  // Entrega del magnet: C2 decide si magnetUrl se firma (bucket privado) o va directo (público).
  return NextResponse.json({ ok: true, magnet_url: magnetUrl });
}
