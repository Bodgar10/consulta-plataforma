import { Resend } from 'resend';

interface OwnerNotificationArgs {
  ownerEmail: string;
  subject: string;
  title: string;
  body: string; // HTML interno
}

/**
 * Correo interno de notificación a la profesional.
 * NUNCA lanza.
 */
export async function sendOwnerNotification(args: OwnerNotificationArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? 'no-reply@example.com';
  if (!apiKey) {
    console.error('resend: falta RESEND_API_KEY');
    return;
  }

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: args.ownerEmail,
      subject: args.subject,
      html: `
        <div style="font-family: Inter, system-ui, sans-serif; color:#1F332E; max-width:520px; margin:0 auto; padding:32px 24px;">
          <p style="font-size:20px; font-weight:600; margin:0 0 20px 0;">${args.title}</p>
          ${args.body}
          <hr style="border:none; border-top:1px solid #E8EDE9; margin:28px 0;" />
          <p style="color:#7A7161; font-size:13px; margin:0;">Consultorio Yolanda Miranda · Panel interno</p>
        </div>
      `,
    });
  } catch (err) {
    console.error('resend: excepción enviando notificación al owner', err);
  }
}
