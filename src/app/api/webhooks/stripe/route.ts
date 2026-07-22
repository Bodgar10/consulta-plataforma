import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { getStripe } from '@/lib/payments/stripe';
import { createAdminClient } from '@/utils/supabase/admin';
import { applyConfirmationEffects } from '@/lib/booking/confirm';
import { confirmEventRegistration } from '@/lib/events/confirm-registration';
import { createSignedDownloadUrl } from '@/lib/storage/workshop-files';
import { sendWorkshopConfirmation } from '@/lib/email/workshop-confirmation';

export const dynamic = 'force-dynamic';
// Necesario para verificar la firma con el body crudo.
export const runtime = 'nodejs';

async function confirmWorkshopPurchase(
  admin: ReturnType<typeof createAdminClient>,
  args: { downloadId: string; workshopId: string; tenantId: string; paymentIntentId: string },
): Promise<string> {
  const { data: updated, error } = await admin
    .from('pdf_workshop_downloads')
    .update({ payment_status: 'paid', stripe_payment_intent: args.paymentIntentId })
    .eq('id', args.downloadId)
    .eq('payment_status', 'pending_payment')
    .select('id, email, name')
    .maybeSingle();

  if (error) {
    if ((error as { code?: string }).code === '23505') return 'idempotent_pi';
    return 'update_error';
  }
  if (!updated) return 'idempotent_state';

  const { data: workshop } = await admin
    .from('pdf_workshops')
    .select('title, file_path, grants_free_session')
    .eq('id', args.workshopId)
    .single();

  if (!workshop?.file_path) return 'confirmed_no_file';

  let freeSessionUrl: string | null = null;
  if (workshop.grants_free_session) {
    const { data: creditId } = await admin.rpc('internal_grant_workshop_credit', {
      p_tenant_id: args.tenantId,
      p_email: updated.email,
      p_full_name: updated.name ?? '',
      p_phone: null as unknown as string,
      p_workshop_id: args.workshopId,
    });
    if (creditId) {
      await admin.from('pdf_workshop_downloads').update({ credit_id: creditId }).eq('id', args.downloadId);
      const { data: tenant } = await admin.from('tenants').select('slug').eq('id', args.tenantId).single();
      if (tenant?.slug) {
        const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
        freeSessionUrl = `${base}/${tenant.slug}/agendar?credito=${args.downloadId}`;
      }
    }
  }

  const downloadUrl = await createSignedDownloadUrl(workshop.file_path);
  if (downloadUrl) {
    await sendWorkshopConfirmation({
      email: updated.email,
      name: updated.name,
      workshopTitle: workshop.title,
      downloadUrl,
      freeSessionUrl,
    });
  }

  return 'confirmed';
}

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
    // Registro de EVENTO EN VIVO: discriminado por registration_id (no por type).
    {
      const regId = pi.metadata?.registration_id;
      const liveEventId = pi.metadata?.live_event_id;
      const evTenantId = pi.metadata?.tenant_id;
      if (regId && liveEventId && evTenantId && paymentIntentId) {
        const admin = createAdminClient();
        const status = await confirmEventRegistration(admin, {
          registrationId: regId, liveEventId, tenantId: evTenantId, paymentIntentId,
        });
        return NextResponse.json({ received: true, event_registration: status });
      }
    }
    // Compra de TALLER PDF: discriminada por download_id.
    {
      const downloadId = pi.metadata?.download_id;
      const workshopId = pi.metadata?.workshop_id;
      const wsTenantId = pi.metadata?.tenant_id;
      if (downloadId && workshopId && wsTenantId && paymentIntentId) {
        const admin = createAdminClient();
        const status = await confirmWorkshopPurchase(admin, {
          downloadId, workshopId, tenantId: wsTenantId, paymentIntentId,
        });
        return NextResponse.json({ received: true, workshop_purchase: status });
      }
    }
  } else if (event.type === 'checkout.session.completed') {
    const s = event.data.object as Stripe.Checkout.Session;
    // Sólo confirmamos si el pago está liquidado (OXXO puede quedar 'unpaid').
    if (s.payment_status !== 'paid') {
      return NextResponse.json({ received: true, skipped: 'no_paid' });
    }
    appointmentId = s.metadata?.appointment_id;
    paymentIntentId = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
    amountCents = s.amount_total ?? undefined;
    // Registro de EVENTO EN VIVO: discriminado por registration_id (no por type).
    {
      const regId = s.metadata?.registration_id;
      const liveEventId = s.metadata?.live_event_id;
      const evTenantId = s.metadata?.tenant_id;
      if (regId && liveEventId && evTenantId && paymentIntentId) {
        const admin = createAdminClient();
        const status = await confirmEventRegistration(admin, {
          registrationId: regId, liveEventId, tenantId: evTenantId, paymentIntentId,
        });
        return NextResponse.json({ received: true, event_registration: status });
      }
    }
    // Compra de TALLER PDF: discriminada por download_id.
    {
      const downloadId = s.metadata?.download_id;
      const workshopId = s.metadata?.workshop_id;
      const wsTenantId = s.metadata?.tenant_id;
      if (downloadId && workshopId && wsTenantId && paymentIntentId) {
        const admin = createAdminClient();
        const status = await confirmWorkshopPurchase(admin, {
          downloadId, workshopId, tenantId: wsTenantId, paymentIntentId,
        });
        return NextResponse.json({ received: true, workshop_purchase: status });
      }
    }
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
    .select('id, status, stripe_payment_intent, start_at, end_at, video_room_url, tenant_id, patient:patients(full_name, email, phone), tenant:tenants(timezone)')
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

  // Efectos idempotentes de confirmación (sala Daily + correo) — helper único.
  // Solo llegamos aquí si `updated` fue truthy (transición real), así que el
  // correo se manda exactamente una vez por confirmación.
  const patient = (appt as { patient?: { full_name?: string; email?: string; phone?: string } }).patient;
  const tenantTz = (appt as { tenant?: { timezone?: string } }).tenant?.timezone;
  await applyConfirmationEffects(supabase, {
    appointmentId,
    tenantId: appt.tenant_id as string,
    startAt: appt.start_at as string,
    endAt: appt.end_at as string,
    videoRoomUrl: appt.video_room_url as string | null,
    patientEmail: patient?.email ?? null,
    patientFullName: patient?.full_name ?? null,
    patientPhone: patient?.phone ?? null,
    tenantTimezone: tenantTz ?? null,
  });

  return NextResponse.json({ received: true, confirmed: appointmentId });
}
