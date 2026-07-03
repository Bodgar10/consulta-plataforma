import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { validateBookingWindow } from '@/lib/booking/validate';
import { getStripe } from '@/lib/payments/stripe';
import { PAYMENTS_CONFIG, applicationFeeAmount } from '@/lib/payments/config';
import { createDailyRoom } from '@/lib/video/daily';
import { sendAppointmentConfirmation } from '@/lib/email/appointment';
import { linkPatientAccount } from '@/lib/auth/link-account';
import type { BookingSettings } from '@/lib/booking/slots';

export const dynamic = 'force-dynamic';

type PaymentMode = 'card' | 'oxxo' | 'transfer' | 'credit';

interface CreateBody {
  tenant_id: string;
  start_at: string;
  end_at: string;
  full_name: string;
  email: string;
  phone: string;
  password?: string | null;
  payment_mode: PaymentMode;
  consent: { accepted: boolean; privacy_version: string };
}

function isSlotConflict(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  const code = (err as { code?: string })?.code ?? '';
  return code === '23P01' || msg.includes('El horario ya no está disponible');
}

// Registra la evidencia de consentimiento LFPDPPP ligada a la cita ya creada.
// Best-effort: un fallo aquí NO debe tumbar una reserva ya creada; se loguea
// para monitoreo (la aceptación ya se validó server-side arriba). La función
// deriva tenant_id/patient_id del appointment_id en el servidor.
async function recordConsent(
  supabase: ReturnType<typeof createAdminClient>,
  appointmentId: string,
  privacyVersion: string,
  ip: string | null,
  userAgent: string | null,
): Promise<void> {
  try {
    const { error } = await supabase.rpc('public_record_consent', {
      p_appointment_id: appointmentId,
      p_privacy_version: privacyVersion,
      // La función acepta null (columnas nullables), pero los tipos generados
      // marcan los args como string; el cast preserva el null en runtime.
      p_ip: ip as string,
      p_user_agent: userAgent as string,
    });
    if (error) console.error('consent_record_failed', appointmentId, error.message);
  } catch (e) {
    console.error('consent_record_threw', appointmentId, e);
  }
}

export async function POST(req: NextRequest) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'json inválido' }, { status: 400 });
  }

  const { tenant_id, start_at, end_at, full_name, email, phone, password, payment_mode, consent } =
    body;

  if (!tenant_id || !start_at || !end_at || !full_name || !email || !phone || !payment_mode) {
    return NextResponse.json({ error: 'faltan campos requeridos' }, { status: 400 });
  }
  // Datos de salud: consentimiento expreso obligatorio, validado en servidor.
  if (!consent?.accepted) {
    return NextResponse.json({ error: 'consentimiento requerido' }, { status: 400 });
  }
  // LFPDPPP: la versión del aviso es parte de la evidencia -> obligatoria.
  if (!consent?.privacy_version) {
    return NextResponse.json({ error: 'privacy_version requerida' }, { status: 400 });
  }

  // Metadatos de evidencia del consentimiento (best-effort; detrás de Vercel
  // la IP viene en x-forwarded-for, que puede ser una lista -> tomamos la 1ra).
  const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? '';
  const ip = ipHeader.split(',')[0]?.trim() || null;
  const userAgent = req.headers.get('user-agent');

  const supabase = createAdminClient();

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('id, timezone, booking_settings, payment_settings')
    .eq('id', tenant_id)
    .eq('status', 'active')
    .single();

  if (tErr || !tenant) {
    return NextResponse.json({ error: 'tenant no encontrado' }, { status: 404 });
  }

  const settings = (tenant.booking_settings as unknown as BookingSettings) ?? {
    lead_time_hours: 12,
    max_horizon_days: 60,
  };
  const ps = (tenant.payment_settings as unknown as Record<string, unknown>) ?? {};

  // Validación server-side de ventana (lead-time / horizonte). Tapa QA-D05.
  const win = validateBookingWindow(start_at, end_at, settings);
  if (!win.ok) {
    return NextResponse.json({ error: win.reason, message: win.message }, { status: 422 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';

  try {
    // ---------------------------------------------------------------
    // CAMINO CRÉDITO: confirma inmediato, sin Stripe. Descuenta paquete.
    // ---------------------------------------------------------------
    if (payment_mode === 'credit') {
      const { data: apptId, error } = await supabase.rpc('public_create_credit_appointment', {
        p_tenant_id: tenant_id,
        p_start_at: start_at,
        p_end_at: end_at,
        p_full_name: full_name,
        p_email: email,
        p_phone: phone,
      });
      if (error) {
        if (isSlotConflict(error)) {
          return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
        }
        return NextResponse.json({ error: error.message }, { status: 422 });
      }

      await recordConsent(supabase, apptId as string, consent.privacy_version, ip, userAgent);

      // Sala Daily + correo inline (no hay webhook en este camino).
      const roomUrl = await createDailyRoom({ appointmentId: apptId as string, startAt: start_at, endAt: end_at });
      if (roomUrl) {
        await supabase.from('appointments').update({ video_room_url: roomUrl }).eq('id', apptId);
      }
      await sendAppointmentConfirmation({ email, fullName: full_name, startAt: start_at, roomUrl, timezone: (tenant.timezone as string) });
      if (password) await linkPatientAccount({ tenantId: tenant_id, email, password });

      return NextResponse.json({ status: 'confirmed', appointment_id: apptId, video_room_url: roomUrl });
    }

    // ---------------------------------------------------------------
    // CAMINOS STRIPE (card/oxxo) y TRANSFERENCIA: crean hold vía función pública.
    // ---------------------------------------------------------------
    const fnMode = payment_mode === 'transfer' ? 'transfer' : 'single';
    const { data: apptId, error } = await supabase.rpc('public_create_appointment', {
      p_tenant_id: tenant_id,
      p_start_at: start_at,
      p_end_at: end_at,
      p_full_name: full_name,
      p_email: email,
      p_phone: phone,
      p_payment_mode: fnMode,
    });
    if (error) {
      if (isSlotConflict(error)) {
        return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    await recordConsent(supabase, apptId as string, consent.privacy_version, ip, userAgent);

    if (password) await linkPatientAccount({ tenantId: tenant_id, email, password });

    // TRANSFERENCIA: brinca Connect. Devuelve datos bancarios para instrucciones.
    if (payment_mode === 'transfer') {
      return NextResponse.json({
        status: 'pending_verification',
        appointment_id: apptId,
        payment_settings: {
          banco: ps['banco'] ?? null,
          titular: ps['titular'] ?? null,
          clabe: ps['clabe'] ?? null,
          whatsapp: ps['whatsapp'] ?? null,
        },
      });
    }

    // CARD / OXXO: Checkout Connect (destination charge con application_fee).
    const stripeAccountId = ps['stripe_account_id'] as string | undefined;
    const sessionPriceCents = Number(ps['session_price_cents'] ?? 0);
    if (!stripeAccountId) {
      return NextResponse.json({ error: 'connect_not_ready', message: 'La cuenta de cobro no está configurada.' }, { status: 409 });
    }
    if (!sessionPriceCents) {
      return NextResponse.json({ error: 'price_not_set', message: 'No hay precio de sesión configurado.' }, { status: 409 });
    }

    const stripe = getStripe();
    const methodTypes = payment_mode === 'oxxo' ? [...PAYMENTS_CONFIG.methods.oxxo] : [...PAYMENTS_CONFIG.methods.card];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: methodTypes as Array<'card' | 'oxxo'>,
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: PAYMENTS_CONFIG.currency,
            product_data: { name: 'Sesión' },
            unit_amount: sessionPriceCents,
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeAmount(sessionPriceCents),
        transfer_data: { destination: stripeAccountId },
        metadata: { appointment_id: String(apptId), tenant_id },
      },
      metadata: { appointment_id: String(apptId), tenant_id },
      ...(payment_mode === 'oxxo'
        ? { payment_method_options: { oxxo: { expires_after_days: PAYMENTS_CONFIG.oxxoExpiresAfterDays } } }
        : {}),
      success_url: `${appUrl}/${tenant_id}/agendar/gracias?appt=${apptId}`,
      cancel_url: `${appUrl}/${tenant_id}/agendar?cancelled=1`,
    });

    return NextResponse.json({ checkout_url: session.url });
  } catch (err) {
    if (isSlotConflict(err)) {
      return NextResponse.json({ error: 'slot_unavailable' }, { status: 409 });
    }
    console.error('booking/create error', err);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }
}
