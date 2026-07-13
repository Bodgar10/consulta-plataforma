import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createClient } from '@/utils/supabase/server';
import { createCheckoutSession } from '@/lib/payments/checkout';
import { confirmFreeEventRegistration } from '@/lib/events/confirm-registration';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let tenantId = '', eventId = '', email = '', name = '';
  try {
    const b = await req.json();
    tenantId = String(b?.tenant_id ?? '');
    eventId = String(b?.event_id ?? '');
    email = String(b?.email ?? '').trim().toLowerCase();
    name = String(b?.name ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!tenantId || !eventId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // 1) Evento publicado (precio + cupo) por la función definer.
  const { data: event, error: evErr } = await supabase.rpc('public_get_live_event', {
    p_tenant_id: tenantId, p_event_id: eventId,
  });
  if (evErr || !event) {
    return NextResponse.json({ error: 'event_unavailable' }, { status: 404 });
  }
  const priceCents = Number((event as { price_cents?: number | null }).price_cents ?? 0);

  // 2) Registrar con control de cupo (FOR UPDATE dentro de la función).
  // Z2: si hay sesión activa, registra ligando auth_user_id en el momento.
  // El client de sesión (cookies) evalúa auth.uid() dentro de la función definer.
  const sessionClient = await createClient(); // utils/supabase/server
  const { data: { user: sessionUser } } = await sessionClient.auth.getUser();

  const { data: regId, error: regErr } = sessionUser
    ? await sessionClient.rpc('public_register_live_event_as_user', {
        p_tenant_id: tenantId, p_event_id: eventId, p_email: email, p_name: name,
      })
    : await supabase.rpc('public_register_live_event', {
        p_tenant_id: tenantId, p_event_id: eventId, p_email: email, p_name: name,
      });
  if (regErr) {
    const full = /lleno/i.test(regErr.message);
    return NextResponse.json(
      { error: full ? 'event_full' : 'register_failed' },
      { status: full ? 409 : 400 },
    );
  }

  // 2.5) Consentimiento expreso (datos sensibles): versión anclada server-side.
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
      await supabase.rpc('public_record_event_consent', {
        p_registration_id: regId,
        p_privacy_version: serverPrivacyVersion,
        // La función acepta null (columnas nullables); el cast preserva el null
        // en runtime, igual que en booking/create.
        p_ip: ip as string,
        p_user_agent: ua as string,
      });
    } catch (e) {
      console.error('record_event_consent best-effort failed', e);
    }
  }

  // 3) Gratis (Z1): asegura la sala compartida y manda el correo de confirmación,
  // igual que el camino de pago. Best-effort: un fallo aquí NO tumba el registro.
  if (priceCents <= 0) {
    try {
      await confirmFreeEventRegistration(supabase, {
        registrationId: regId as string,
        liveEventId: eventId,
        tenantId,
      });
    } catch (e) {
      console.error('confirmFreeEventRegistration best-effort failed', e);
    }
    return NextResponse.json({ status: 'registered', registration_id: regId });
  }

  // 4) Pago (solo tarjeta). Lee stripe_account_id de payment_settings como booking.
  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('payment_settings')
    .eq('id', tenantId)
    .eq('status', 'active')
    .single();
  const stripeAccountId = (tenant?.payment_settings as Record<string, unknown> | null)?.['stripe_account_id'] as string | undefined;
  if (tErr || !stripeAccountId) {
    return NextResponse.json({ error: 'connect_not_ready' }, { status: 409 });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const session = await createCheckoutSession({
    stripeAccountId,
    amountCents: priceCents,
    productName: (event as { title?: string }).title ?? 'Evento en vivo',
    customerEmail: email,
    method: 'card',
    successUrl: `${base}/evento/${eventId}?pago=ok`,
    cancelUrl: `${base}/evento/${eventId}?pago=cancelado`,
    metadata: {
      live_event_id: eventId,
      registration_id: String(regId),
      tenant_id: tenantId,
    },
  });

  return NextResponse.json({ status: 'checkout', checkout_url: session.url });
}
