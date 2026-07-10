import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createCheckoutSession } from '@/lib/payments/checkout';

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
  const { data: regId, error: regErr } = await supabase.rpc('public_register_live_event', {
    p_tenant_id: tenantId, p_event_id: eventId, p_email: email, p_name: name,
  });
  if (regErr) {
    const full = /lleno/i.test(regErr.message);
    return NextResponse.json(
      { error: full ? 'event_full' : 'register_failed' },
      { status: full ? 409 : 400 },
    );
  }

  // 3) Gratis: listo (el correo de eventos gratis puede mandarse aquí en una iteración futura).
  if (priceCents <= 0) {
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
