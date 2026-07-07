import { createAdminClient } from '@/utils/supabase/admin';
import { createDailyRoom } from '@/lib/video/daily';
import { sendAppointmentConfirmation } from '@/lib/email/appointment';

export interface ConfirmationEffectsInput {
  appointmentId: string;
  startAt: string;            // ISO UTC
  endAt: string;              // ISO UTC
  videoRoomUrl: string | null;
  patientEmail: string | null;
  patientFullName: string | null;
  tenantTimezone: string | null;
}

/**
 * FUENTE ÚNICA de los efectos posteriores a que una cita queda 'confirmed':
 * asegura la sala Daily (crea SOLO si falta -> idempotente) y manda el correo.
 * La invocan los TRES caminos de confirmación: webhook de Stripe (card/oxxo),
 * camino-crédito de booking/create, y confirmación manual de transferencia.
 *
 * NUNCA lanza (createDailyRoom y sendAppointmentConfirmation ya tragan sus
 * errores). Devuelve la roomUrl final (o null si Daily falló).
 *
 * IMPORTANTE: el correo NO es idempotente por sí mismo. Cada caller es
 * responsable de invocar esto UNA sola vez por confirmación (el webhook con su
 * guard de `updated`, la confirmación manual con el flag `transitioned`). El
 * descuento de crédito NO vive aquí: es atómico dentro de la función SQL
 * public_create_credit_appointment.
 */
export async function applyConfirmationEffects(
  supabase: ReturnType<typeof createAdminClient>,
  input: ConfirmationEffectsInput,
): Promise<string | null> {
  let roomUrl = input.videoRoomUrl;

  if (!roomUrl) {
    roomUrl = await createDailyRoom({
      appointmentId: input.appointmentId,
      startAt: input.startAt,
      endAt: input.endAt,
    });
    if (roomUrl) {
      await supabase
        .from('appointments')
        .update({ video_room_url: roomUrl })
        .eq('id', input.appointmentId);
    }
  }

  if (input.patientEmail) {
    await sendAppointmentConfirmation({
      email: input.patientEmail,
      fullName: input.patientFullName ?? '',
      startAt: input.startAt,
      roomUrl,
      timezone: input.tenantTimezone ?? undefined,
    });
  }

  return roomUrl;
}
