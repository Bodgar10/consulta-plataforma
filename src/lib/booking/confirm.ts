import { createAdminClient } from '@/utils/supabase/admin';
import { createDailyRoom } from '@/lib/video/daily';
import { sendAppointmentConfirmation } from '@/lib/email/appointment';
import { getOwnerEmail } from '@/lib/email/get-owner-email';
import { sendOwnerNotification } from '@/lib/email/owner-notification';
import { DateTime } from 'luxon';

export interface ConfirmationEffectsInput {
  appointmentId: string;
  tenantId: string;
  startAt: string;            // ISO UTC
  endAt: string;              // ISO UTC
  videoRoomUrl: string | null;
  patientEmail: string | null;
  patientFullName: string | null;
  patientPhone?: string | null;
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
      name: `appt-${input.appointmentId}`,
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

  // Notificar al owner de la confirmación
  const ownerEmail = await getOwnerEmail(input.tenantId);
  if (ownerEmail) {
    const cuando = input.tenantTimezone
      ? DateTime.fromISO(input.startAt, { zone: 'utc' })
          .setZone(input.tenantTimezone)
          .setLocale('es')
          .toFormat("cccc d 'de' LLLL 'a las' HH:mm")
      : input.startAt;

    const waNumber = (input.patientPhone ?? '').replace(/\D/g, '');
    const waText = encodeURIComponent(
      `Hola ${input.patientFullName ?? ''}, soy Yolanda Miranda. Tu sesión del ${cuando} está confirmada. ¡Te espero!`
    );
    const waBlock = waNumber
      ? `<p style="margin:16px 0 0 0;">
          <a href="https://wa.me/${waNumber}?text=${waText}" style="background:#25D366; color:#fff; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block; font-size:14px;">
            Escribir por WhatsApp
          </a>
        </p>`
      : '';

    const roomBlock = roomUrl
      ? `<p style="margin:16px 0 0 0;">
          <a href="${roomUrl}" style="background:#3C6E63; color:#FBFAF7; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block; font-size:14px;">
            Entrar a la videollamada
          </a>
        </p>`
      : '';

    await sendOwnerNotification({
      ownerEmail,
      subject: `Cita confirmada — ${input.patientFullName ?? 'Paciente'}`,
      title: '✅ Cita confirmada',
      body: `
        <p style="font-size:15px; margin:0 0 16px 0;">
          La sesión de <strong>${input.patientFullName ?? 'tu paciente'}</strong> del <strong>${cuando}</strong> está confirmada.
        </p>
        <div style="background:#F5F7F5; border-radius:10px; padding:16px; margin:0 0 16px 0;">
          <p style="margin:0 0 6px 0;"><strong>Correo:</strong> ${input.patientEmail ?? '—'}</p>
          ${input.patientPhone ? `<p style="margin:0;"><strong>Teléfono:</strong> ${input.patientPhone}</p>` : ''}
        </div>
        ${roomBlock}
        ${waBlock}
      `,
    });
  }

  return roomUrl;
}
