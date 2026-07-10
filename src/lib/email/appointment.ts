import { Resend } from 'resend';
import { DateTime } from 'luxon';

interface ConfirmationArgs {
  email: string;
  fullName: string;
  startAt: string;          // ISO UTC
  roomUrl: string | null;
  timezone?: string;        // IANA para formatear la fecha al paciente
}

/**
 * Envía el correo de confirmación con el link de la sesión.
 * NUNCA lanza: un fallo de correo no debe tumbar la confirmación del pago.
 */
export async function sendAppointmentConfirmation(args: ConfirmationArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? 'no-reply@example.com';
  if (!apiKey) {
    console.error('resend: falta RESEND_API_KEY');
    return;
  }

  // Sin fallback a CDMX (Z2): si el caller no pasó la zona del tenant, es un bug de
  // config. Formateamos la fecha SOLO si hay zona; si no, se omite la línea de fecha
  // (no se inventa una zona).
  let cuando: string | null = null;
  if (args.timezone) {
    cuando = DateTime.fromISO(args.startAt, { zone: 'utc' })
      .setZone(args.timezone)
      .setLocale('es')
      .toFormat("cccc d 'de' LLLL, HH:mm");
  } else {
    console.error('resend: sin timezone del tenant; se omite la línea de fecha', args.email);
  }

  const fechaBlock = cuando
    ? `<p>Tu sesión quedó confirmada para el <strong>${cuando}</strong>.</p>`
    : `<p>Tu sesión quedó confirmada.</p>`;

  const linkBlock = args.roomUrl
    ? `<p>Tu sesión será por videollamada. Únete aquí a la hora acordada:</p>
       <p><a href="${args.roomUrl}">${args.roomUrl}</a></p>`
    : `<p>Te enviaremos el link de la videollamada por separado.</p>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: args.email,
      subject: 'Tu sesión está confirmada',
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; color:#1F332E;">
          <p>Hola ${args.fullName},</p>
          ${fechaBlock}
          ${linkBlock}
          <p style="color:#7A7161; font-size:14px;">Si necesitas reagendar, responde a este correo.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('resend: excepción enviando confirmación', err);
  }
}
