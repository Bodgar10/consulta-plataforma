import { Resend } from 'resend';
import { DateTime } from 'luxon';

interface TransferInstructionsArgs {
  email: string;
  fullName: string;
  startAt: string;        // ISO UTC
  timezone: string;       // IANA del tenant
  banco: string | null;
  titular: string | null;
  clabe: string | null;
  whatsapp: string | null;
}

/**
 * Correo de instrucciones de transferencia bancaria.
 * Se envía justo después de crear la cita, antes de que la profesional confirme.
 * NUNCA lanza: un fallo de correo no debe tumbar la creación de la cita.
 */
export async function sendTransferInstructions(args: TransferInstructionsArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@example.com';
  if (!apiKey) {
    console.error('resend: falta RESEND_API_KEY');
    return;
  }

  const cuando = DateTime.fromISO(args.startAt, { zone: 'utc' })
    .setZone(args.timezone)
    .setLocale('es')
    .toFormat("cccc d 'de' LLLL 'a las' HH:mm");

  // Texto pre-llenado para WhatsApp
  const waText = encodeURIComponent(
    `Hola, soy ${args.fullName}. Realicé mi transferencia para la sesión del ${cuando}. Adjunto mi comprobante.`
  );
  const waNumber = args.whatsapp?.replace(/\D/g, '') ?? '';
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${waText}` : null;

  const waBlock = waUrl
    ? `
      <div style="background:#E8F0ED; border-radius:10px; padding:16px; margin:20px 0;">
        <p style="margin:0 0 10px 0; font-weight:500;">¿Ya realizaste tu transferencia?</p>
        <p style="margin:0 0 14px 0; color:#7A7161; font-size:14px;">
          Envía tu comprobante por WhatsApp indicando tu nombre completo y el día y hora de tu cita.
          Tu sesión se confirmará en cuanto lo recibamos.
        </p>
        <a href="${waUrl}" style="background:#25D366; color:#fff; padding:10px 20px; border-radius:10px; text-decoration:none; display:inline-block; font-size:15px;">
          Enviar comprobante por WhatsApp
        </a>
      </div>
    `
    : `<p style="color:#7A7161; font-size:14px;">Envía tu comprobante de transferencia por WhatsApp indicando tu nombre completo y el día y hora de tu cita.</p>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: args.email,
      subject: 'Instrucciones para completar tu reserva',
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; color:#1F332E; max-width:520px; margin:0 auto; padding:32px 24px;">

          <p style="font-size:22px; font-weight:600; margin:0 0 8px 0;">¡Tu lugar está apartado!</p>
          <p style="font-size:15px; color:#7A7161; margin:0 0 24px 0;">Solo falta completar el pago para confirmar tu sesión.</p>

          <p style="font-size:15px; line-height:1.6; margin:0 0 6px 0;">
            Hola <strong>${args.fullName}</strong>, recibimos tu solicitud para la sesión del:
          </p>
          <p style="font-size:17px; font-weight:600; margin:0 0 24px 0;">${cuando}</p>

          <div style="background:#F5F7F5; border-radius:10px; padding:16px; margin:0 0 20px 0;">
            <p style="margin:0 0 8px 0; font-weight:500; font-size:14px; color:#7A7161; text-transform:uppercase; letter-spacing:0.05em;">Datos para tu transferencia</p>
            ${args.banco ? `<p style="margin:0 0 4px 0;"><strong>Banco:</strong> ${args.banco}</p>` : ''}
            ${args.titular ? `<p style="margin:0 0 4px 0;"><strong>Titular:</strong> ${args.titular}</p>` : ''}
            ${args.clabe ? `<p style="margin:0;"><strong>CLABE:</strong> ${args.clabe}</p>` : ''}
          </div>

          ${waBlock}

          <hr style="border:none; border-top:1px solid #E8EDE9; margin:28px 0;" />
          <p style="color:#7A7161; font-size:13px; margin:0;">
            Yolanda Miranda · Psicoanálisis<br/>
            <a href="https://yolandamiranda.mx" style="color:#3C6E63; text-decoration:none;">yolandamiranda.mx</a>
          </p>

        </div>
      `,
    });
  } catch (err) {
    console.error('resend: excepción enviando instrucciones de transferencia', err);
  }
}
