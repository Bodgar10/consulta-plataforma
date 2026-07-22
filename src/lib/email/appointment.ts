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
  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@example.com';
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
    ? `<div style="background:#F5F7F5; border-radius:10px; padding:16px; margin:0 0 16px 0;">
         <p style="margin:0 0 6px 0; font-weight:500; font-size:14px; color:#7A7161; text-transform:uppercase; letter-spacing:0.05em;">Tu sesión</p>
         <p style="margin:0; font-size:17px; font-weight:600;">${cuando}</p>
       </div>`
    : `<div style="background:#F5F7F5; border-radius:10px; padding:16px; margin:0 0 16px 0;">
         <p style="margin:0; font-size:17px; font-weight:600;">Tu sesión quedó confirmada.</p>
       </div>`;

  const linkBlock = args.roomUrl
    ? `<p style="font-size:15px; line-height:1.6; margin:0 0 12px 0;">Tu sesión será por videollamada. Únete aquí a la hora acordada:</p>
       <p style="margin:0 0 4px 0;">
         <a href="${args.roomUrl}" style="background:#3C6E63; color:#FBFAF7; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block; font-size:14px;">Entrar a la videollamada</a>
       </p>`
    : `<p style="font-size:15px; line-height:1.6; margin:0;">Te enviaremos el link de la videollamada por separado.</p>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: args.email,
      subject: 'Tu sesión está confirmada',
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; color:#1F332E; max-width:520px; margin:0 auto; padding:32px 24px; font-size:15px; line-height:1.6;">

          <p style="font-size:22px; font-weight:600; margin:0 0 8px 0;">✅ Tu sesión está confirmada</p>
          <p style="font-size:15px; color:#7A7161; margin:0 0 24px 0;">${args.fullName ? `Hola ${args.fullName}, ya` : 'Ya'} tienes tu lugar reservado.</p>

          ${fechaBlock}

          ${linkBlock}

          <p style="color:#7A7161; font-size:14px; margin:20px 0 0 0;">Si necesitas reagendar, responde a este correo.</p>

          <hr style="border:none; border-top:1px solid #E8EDE9; margin:28px 0;" />
          <p style="color:#7A7161; font-size:13px; margin:0;">
            Consultorio Yolanda Miranda · <a href="https://yolandamiranda.mx" style="color:#3C6E63; text-decoration:none;">yolandamiranda.mx</a>
          </p>

        </div>
      `,
    });
  } catch (err) {
    console.error('resend: excepción enviando confirmación', err);
  }
}
