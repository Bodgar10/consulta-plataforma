import { Resend } from 'resend';
import { DateTime } from 'luxon';

interface EventAnnouncementArgs {
  email: string;
  name: string | null;
  eventTitle: string;
  eventDescription: string | null;
  startAt: string;
  timezone: string;
  registerUrl: string;
  unsubscribeUrl: string;
}

/**
 * Correo de anuncio de un taller/curso nuevo, con botón de registro y link
 * de baja. NUNCA lanza: un fallo de un correo individual no debe tumbar el
 * envío masivo completo (cada llamada se hace en su propio try/catch por el
 * caller).
 */
export async function sendEventAnnouncement(args: EventAnnouncementArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@example.com';
  if (!apiKey) {
    console.error('resend: falta RESEND_API_KEY');
    return;
  }

  const cuando = DateTime.fromISO(args.startAt, { zone: 'utc' })
    .setZone(args.timezone)
    .setLocale('es')
    .toFormat("cccc d 'de' LLLL, HH:mm");

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: args.email,
      subject: `Nuevo taller: ${args.eventTitle}`,
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; color:#1F332E;">
          <p>Hola ${args.name ?? ''},</p>
          <p>Tenemos un nuevo espacio en vivo: <strong>${args.eventTitle}</strong>.</p>
          <p>${cuando}</p>
          ${args.eventDescription ? `<p>${args.eventDescription}</p>` : ''}
          <p style="margin-top:20px;">
            <a href="${args.registerUrl}" style="background:#C96F4A; color:#FBFAF7; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block;">
              Reservar mi lugar
            </a>
          </p>
          <p style="color:#7A7161; font-size:12px; margin-top:24px;">
            <a href="${args.unsubscribeUrl}" style="color:#7A7161;">Dejar de recibir estos avisos</a>
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error('resend: excepción enviando anuncio de evento', args.email, err);
  }
}
