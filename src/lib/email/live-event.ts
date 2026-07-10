import { Resend } from 'resend';
import { DateTime } from 'luxon';
import { createAdminClient } from '@/utils/supabase/admin';

// Mismo estilo que sendAppointmentConfirmation: Resend directo, from de env, html inline, luxon.
// Se llama desde el webhook (B2) SOLO tras confirmar el pago en esta invocación (envío único).
export async function sendLiveEventConfirmation(args: { registrationId: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) { console.warn('[live-event email] RESEND_API_KEY ausente; no se envía'); return; }

  const supabase = createAdminClient();

  const { data: reg } = await supabase
    .from('live_event_registrations')
    .select('email, name, live_event_id, tenant_id')
    .eq('id', args.registrationId)
    .single();
  if (!reg) return;

  const { data: ev } = await supabase
    .from('live_events')
    .select('title, start_at, video_room_url')
    .eq('id', reg.live_event_id)
    .single();
  if (!ev) return;

  const { data: tenant } = await supabase
    .from('tenants')
    .select('display_name, timezone')
    .eq('id', reg.tenant_id)
    .single();

  const zone = tenant?.timezone ?? null;
  const cuando = zone
    ? DateTime.fromISO(ev.start_at, { zone: 'utc' }).setZone(zone).setLocale('es').toFormat("cccc d 'de' LLLL, HH:mm")
    : null;
  const sala = ev.video_room_url ?? '';

  const html = `
    <div style="font-family:sans-serif;font-size:15px;color:#222">
      <h2>Tu lugar está confirmado</h2>
      <p>Hola ${reg.name ?? ''}, quedaste registrado en <strong>${ev.title}</strong>.</p>
      ${cuando ? `<p><strong>Cuándo:</strong> ${cuando}${zone ? ` (${zone})` : ''}</p>` : ''}
      ${sala ? `<p><strong>Enlace de la sala:</strong> <a href="${sala}">${sala}</a></p>` : ''}
      <p>Te esperamos.${tenant?.display_name ? ` — ${tenant.display_name}` : ''}</p>
    </div>
  `;

  const resend = new Resend(apiKey);
  const from = process.env.RESEND_FROM ?? 'no-reply@example.com';
  try {
    await resend.emails.send({ from, to: reg.email, subject: `Confirmado: ${ev.title}`, html });
  } catch (e) {
    console.error('[live-event email] fallo al enviar', e); // nunca lanza (como appointment.ts)
  }
}
