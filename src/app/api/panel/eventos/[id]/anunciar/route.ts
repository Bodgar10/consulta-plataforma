import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { sendEventAnnouncement } from '@/lib/email/event-announcement';

export const dynamic = 'force-dynamic';

interface Recipient {
  email: string;
  name: string | null;
  unsubscribe_token: string;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { data: context } = await supabase.rpc('current_user_context').maybeSingle();
  if (!context?.is_professional || !context.tenant_slug) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  }

  const { data: tenantIds } = await supabase.rpc('current_user_tenant_ids');
  const tenantId = (tenantIds as string[] | null)?.[0] ?? null;
  if (!tenantId) {
    return NextResponse.json({ error: 'sin tenant' }, { status: 403 });
  }

  const { data: tenant } = await supabase
    .from('tenants')
    .select('timezone')
    .eq('id', tenantId)
    .single();

  const { data: event, error: evErr } = await supabase
    .from('live_events')
    .select('id, title, description, start_at')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single();

  if (evErr || !event) {
    return NextResponse.json({ error: 'evento no encontrado' }, { status: 404 });
  }

  // Reúne destinatarios de las 3 fuentes, dedupe por correo. Si una misma
  // persona aparece en más de una tabla (p. ej. lead Y paciente), el link de
  // baja del correo que reciba solo apaga esa fila específica; si quiere
  // apagar del todo, tendría que usarlo una vez por cada correo que le llegue
  // (caso raro, no bloqueante para esta primera versión).
  const [{ data: patients }, { data: leads }, { data: registrations }] = await Promise.all([
    supabase
      .from('patients')
      .select('email, full_name, unsubscribe_token')
      .eq('tenant_id', tenantId)
      .eq('wants_event_notifications', true),
    supabase
      .from('leads')
      .select('email, name, unsubscribe_token')
      .eq('tenant_id', tenantId)
      .eq('wants_event_notifications', true),
    supabase
      .from('live_event_registrations')
      .select('email, name, unsubscribe_token')
      .eq('tenant_id', tenantId)
      .eq('wants_event_notifications', true),
  ]);

  const byEmail = new Map<string, Recipient>();
  for (const p of patients ?? []) {
    byEmail.set(p.email, { email: p.email, name: p.full_name, unsubscribe_token: p.unsubscribe_token });
  }
  for (const l of leads ?? []) {
    if (!byEmail.has(l.email)) {
      byEmail.set(l.email, { email: l.email, name: l.name, unsubscribe_token: l.unsubscribe_token });
    }
  }
  for (const r of registrations ?? []) {
    if (!byEmail.has(r.email)) {
      byEmail.set(r.email, { email: r.email, name: r.name, unsubscribe_token: r.unsubscribe_token });
    }
  }

  const recipients = Array.from(byEmail.values());
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const registerUrl = `${appUrl}/${context.tenant_slug}/evento/${event.id}`;
  const timezone = (tenant?.timezone as string) ?? 'America/Mexico_City';

  let sent = 0;
  for (const r of recipients) {
    try {
      await sendEventAnnouncement({
        email: r.email,
        name: r.name,
        eventTitle: event.title,
        eventDescription: event.description,
        startAt: event.start_at,
        timezone,
        registerUrl,
        unsubscribeUrl: `${appUrl}/baja?token=${r.unsubscribe_token}`,
      });
      sent++;
    } catch (e) {
      console.error('anunciar evento: fallo individual', r.email, e);
    }
  }

  return NextResponse.json({ ok: true, total: recipients.length, sent });
}
