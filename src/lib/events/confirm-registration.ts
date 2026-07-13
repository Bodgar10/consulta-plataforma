import type { createAdminClient } from '@/utils/supabase/admin';
import { createDailyRoom } from '@/lib/video/daily';
import { sendLiveEventConfirmation } from '@/lib/email/live-event';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Asegura la sala Daily COMPARTIDA del evento (una por evento, idempotente con
 * guard is-null anti-carrera) y manda el correo de confirmación. NO toca
 * payment_status. Compartido por el camino de PAGO (confirmEventRegistration,
 * tras marcar paid) y el GRATIS (confirmFreeEventRegistration).
 */
async function ensureEventRoomAndNotify(
  supabase: Admin,
  args: { registrationId: string; liveEventId: string; tenantId: string },
): Promise<void> {
  const { data: ev } = await supabase
    .from('live_events')
    .select('video_room_url, start_at, end_at')
    .eq('id', args.liveEventId)
    .eq('tenant_id', args.tenantId)
    .single();

  if (ev && !ev.video_room_url) {
    const roomUrl = await createDailyRoom({
      name: `event-${args.liveEventId}`,
      startAt: ev.start_at,
      endAt: ev.end_at,
    });
    if (roomUrl) {
      await supabase
        .from('live_events')
        .update({ video_room_url: roomUrl })
        .eq('id', args.liveEventId)
        .is('video_room_url', null);
    }
  }

  await sendLiveEventConfirmation({ registrationId: args.registrationId });
}

/**
 * Confirma el registro de evento de PAGO de forma idempotente y asegura la sala
 * compartida. Devuelve un string de estado para el log del webhook. No reusa
 * applyConfirmationEffects (acoplado a appointments); usa una sala por evento.
 */
export async function confirmEventRegistration(
  supabase: Admin,
  args: { registrationId: string; liveEventId: string; tenantId: string; paymentIntentId: string },
): Promise<string> {
  // 1) Marcar pagado SOLO si estaba pending_payment (idempotente ante reintentos).
  const { data, error } = await supabase
    .from('live_event_registrations')
    .update({ payment_status: 'paid', stripe_payment_intent: args.paymentIntentId })
    .eq('id', args.registrationId)
    .eq('payment_status', 'pending_payment')
    .select('id')
    .maybeSingle();

  if (error) {
    // 23505 = el PI ya confirmó otro registro -> idempotente, no re-disparamos efectos.
    if ((error as { code?: string }).code === '23505') return 'idempotent_pi';
    return 'update_error';
  }
  if (!data?.id) return 'idempotent_state'; // ya estaba paid / no en hold

  // 2+3) Sala compartida + correo (solo se llega aquí en transición real).
  await ensureEventRoomAndNotify(supabase, {
    registrationId: args.registrationId,
    liveEventId: args.liveEventId,
    tenantId: args.tenantId,
  });

  return 'confirmed';
}

/**
 * Z1 — Confirma un registro GRATIS: el evento no pasa por Stripe (nace 'free'),
 * así que el webhook nunca lo confirma. Asegura la sala y manda el correo igual
 * que el camino de pago. Idempotencia acotada: pensado para llamarse best-effort
 * una vez por registro desde el route; una doble-submisión podría reenviar el
 * correo (el front bloquea tras el primer OK). No toca payment_status.
 */
export async function confirmFreeEventRegistration(
  supabase: Admin,
  args: { registrationId: string; liveEventId: string; tenantId: string },
): Promise<void> {
  await ensureEventRoomAndNotify(supabase, args);
}
