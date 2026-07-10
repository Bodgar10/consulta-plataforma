import type { createAdminClient } from '@/utils/supabase/admin';
import { createDailyRoom } from '@/lib/video/daily';
import { sendLiveEventConfirmation } from '@/lib/email/live-event';

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Confirma el registro de evento de forma idempotente y asegura la sala compartida.
 * Devuelve un string de estado para el log del webhook. No reusa applyConfirmationEffects
 * (acoplado a appointments); usa createDailyRoom directo con una sala por evento.
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

  // 2) Sala Daily COMPARTIDA del evento (una por evento). Guard is null anti-carrera.
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

  // 3) Correo una sola vez (solo se llega aquí en transición real). No lanza.
  await sendLiveEventConfirmation({ registrationId: args.registrationId });

  return 'confirmed';
}
