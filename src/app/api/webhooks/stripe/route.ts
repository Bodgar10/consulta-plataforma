import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/payments/stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import { createDailyRoom } from '@/lib/video/daily';
import { sendAppointmentConfirmation } from '@/lib/email/appointment';

export const dynamic = 'force-dynamic';
// Necesario para verificar la firma con el body crudo.
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'sin webhook secret' }, { status: 500 });

  const sig = req.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'sin firma' }, { status: 400 });

  const raw = await req.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    console.error('webhook: firma inválida', err);
    return NextResponse.json({ error: 'firma inválida' }, { status: 400 });
  }

  // Extraer (appointment_id, payment_intent_id, amount) según el tipo de evento.
  let appointmentId: string | undefined;
  let paymentIntentId: string | undefined;
  let amountCents: number | undefined;

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object as Stripe.PaymentIntent;
    appointmentId = pi.metadata?.appointment_id;
    paymentIntentId = pi.id;
    amountCents = pi.amount_received ?? pi.amount ?? undefined;
  } else if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    // Sólo confirmamos si el pago está liquidado (OXXO puede quedar 'unpaid').
    if (s.payment_status !== 'paid') {
      return NextResponse.json({ received: true, skipped: 'no_paid' });
    }
    appointmentId = s.metadata?.appointment_id;
    paymentIntentId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
    amountCents = s.amount_total ?? undefined;
  } else {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  if (!appointmentId || !paymentIntentId) {
    return NextResponse.json({ received: true, skipped: 'sin_metadata' });
  }

  const supabase = createAdminClient();

  // Traer la cita + paciente + tenant (para idempotencia y para el correo/sala).
  const { data: appt, error: aErr } = await supabase
    .from('appointments')
    .select('id, status, stripe_payment_intent, start_at, end_at, video_room_url, tenant_id, patient:patients(full_name, email), tenant:tenants(timezone)')
    .eq('id', appointmentId)
    .single();

  if (aErr || !appt) {
    console.error('webhook: cita no encontrada', appointmentId, aErr);
    return NextResponse.json({ received: true, skipped: 'cita_no_encontrada' });
  }

  // IDEMPOTENCIA: si ya está confirmada con este mismo PI, no hacemos nada.
  if (appt.status === 'confirmed' && appt.stripe_payment_intent === paymentIntentId) {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Confirmar sólo desde un estado de hold pendiente. La actualización condicionada
  // por status evita pisar un estado ya avanzado ante eventos fuera de orden.
  const { data: updated, error: uErr } = await supabase
    .from('appointments')
    .update({
      status: 'confirmed',
      stripe_payment_intent: paymentIntentId,
      amount_paid_cents: amountCents ?? null,
    })
    .eq('id', appointmentId)
    .in('status', ['pending_payment', 'pending_verification'])
    .select('id')
    .maybeSingle();

  if (uErr) {
    // Choque con el índice único de PI => otro proceso ya lo confirmó. Idempotente.
    if ((uErr as { code?: string }).code === '23505') {
      return NextResponse.json({ received: true, idempotent: true });
    }
    console.error('webhook: error confirmando', uErr);
    return NextResponse.json({ error: 'error confirmando' }, { status: 500 });
  }
  if (!updated) {
    // No estaba en estado de hold (ya confirmada por otra vía). No dupliques efectos.
    return NextResponse.json({ received: true, idempotent: true });
  }

  // Efectos posteriores a la confirmación: sala Daily + correo. No rompen si fallan.
  let roomUrl = appt.video_room_url as string | null;
  if (!roomUrl) {
    roomUrl = await createDailyRoom({
      appointmentId: appointmentId,
      startAt: appt.start_at as string,
      endAt: appt.end_at as string,
    });
    if (roomUrl) {
      await supabase.from('appointments').update({ video_room_url: roomUrl }).eq('id', appointmentId);
    }
  }

  const patient = (appt as { patient?: { full_name?: string; email?: string } }).patient;
  const tenantTz = (appt as { tenant?: { timezone?: string } }).tenant?.timezone;
  if (patient?.email) {
    await sendAppointmentConfirmation({
      email: patient.email,
      fullName: patient.full_name ?? '',
      startAt: appt.start_at as string,
      roomUrl,
      timezone: tenantTz,
    });
  }

  return NextResponse.json({ received: true, confirmed: appointmentId });
}
