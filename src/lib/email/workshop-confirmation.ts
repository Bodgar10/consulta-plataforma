import { Resend } from 'resend';

interface WorkshopConfirmationArgs {
  email: string;
  name: string | null;
  workshopTitle: string;
  downloadUrl: string;
  freeSessionUrl?: string | null;
}

/**
 * Correo de confirmación tras comprar o descargar un taller en PDF.
 * Si freeSessionUrl viene poblado, incluye el CTA de la sesión gratis con
 * la recomendación de leer el PDF primero. NUNCA lanza.
 */
export async function sendWorkshopConfirmation(args: WorkshopConfirmationArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@example.com';
  if (!apiKey) {
    console.error('resend: falta RESEND_API_KEY');
    return;
  }

  const freeSessionBlock = args.freeSessionUrl
    ? `
      <div style="background:#E8F0ED; border-radius:10px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 10px 0;"><strong>Tu compra incluye una sesión de terapia gratis.</strong></p>
        <p style="margin:0 0 14px 0; color:#7A7161; font-size:14px;">
          Te recomendamos leer el material primero, para llegar preparado(a) a tu sesión.
        </p>
        <a href="${args.freeSessionUrl}" style="background:#C96F4A; color:#FBFAF7; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block;">
          Agenda mi cita gratis
        </a>
      </div>
    `
    : '';

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: args.email,
      subject: `Tu material: ${args.workshopTitle}`,
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; color:#1F332E;">
          <p>Hola ${args.name ?? ''},</p>
          <p>Gracias por tu interés en <strong>${args.workshopTitle}</strong>. Aquí está tu descarga:</p>
          <p>
            <a href="${args.downloadUrl}" style="background:#3C6E63; color:#FBFAF7; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block;">
              Descargar PDF
            </a>
          </p>
          ${freeSessionBlock}
          <p style="color:#7A7161; font-size:12px; margin-top:24px;">Este enlace de descarga expira en 7 días.</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('resend: excepción enviando confirmación de taller', args.email, err);
  }
}
