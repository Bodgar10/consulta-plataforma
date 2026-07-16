'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DateTime } from 'luxon';
import { createClient } from '@/utils/supabase/client';
import { getStatusBadge, getEventBadge } from '@/lib/panel/status-badge';
import { useTenantTimezone } from '@/lib/tenant/useTenantTimezone';

type Appointment = {
  id: string;
  tenant_id: string;
  start_at: string;
  end_at: string;
  status: string;
  video_room_url: string | null;
};

type EventRegistration = {
  id: string;
  live_event_id: string;
  payment_status: string;
  created_at: string;
  live_events: {
    title: string;
    start_at: string;
    video_room_url: string | null;
  } | null;
};

type Credit = {
  id: string;
  sessions_total: number;
  sessions_used: number;
  expires_at: string;
  status: string;
};

type UpcomingEvent = {
  id: string;
  title: string;
  start_at: string;
  end_at: string;
  price_cents: number | null;
  capacity: number;
  seats_taken: number;
};

function formatFecha(iso: string, timeZone: string | null) {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  if (!timeZone) return dt.setLocale('es').toFormat("d 'de' LLLL, h:mm a") + ' (zona pendiente)';
  return dt.setZone(timeZone).setLocale('es').toFormat("d 'de' LLLL, h:mm a");
}

function formatPrice(cents: number | null) {
  if (!cents) return 'Gratis';
  return (cents / 100).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
}

export default function MiCuentaPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[] | null>(null);
  const [credits, setCredits] = useState<Credit[] | null>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<UpcomingEvent[]>([]);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    Promise.all([
      supabase
        .from('appointments')
        .select('id, tenant_id, start_at, end_at, status, video_room_url')
        .order('start_at', { ascending: false }),
      supabase
        .from('live_event_registrations')
        .select('id, live_event_id, payment_status, created_at, live_events(title, start_at, video_room_url)')
        .order('created_at', { ascending: false }),
      supabase
        .from('patient_credits')
        .select('id, sessions_total, sessions_used, expires_at, status')
        .eq('status', 'active')
        .order('expires_at', { ascending: true }),
    ]).then(async ([apptRes, regRes, creditRes]) => {
      const appts = (apptRes.data as Appointment[]) ?? [];
      setAppointments(appts);
      setRegistrations((regRes.data as EventRegistration[]) ?? []);
      setCredits((creditRes.data as Credit[]) ?? []);

      const primaryTenantId = appts.length > 0 ? appts[0].tenant_id : null;
      if (primaryTenantId) {
        const { data: slug } = await supabase.rpc('public_get_tenant_slug', {
          p_tenant_id: primaryTenantId,
        });
        if (slug) {
          setTenantSlug(slug);
          const { data: events } = await supabase.rpc('public_get_upcoming_events', {
            p_tenant_id: primaryTenantId,
          });
          setUpcomingEvents((events as UpcomingEvent[] | null) ?? []);
        }
      }
      setLoading(false);
    });
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  }

  const tenantId = appointments && appointments.length > 0 ? appointments[0].tenant_id : null;
  const { status: tzStatus, timezone } = useTenantTimezone(tenantId);

  if (loading) {
    return (
      <main className="min-h-screen bg-cream-50 px-4 py-12">
        <p className="muted text-center">Cargando…</p>
      </main>
    );
  }

  const now = DateTime.now();
  const proximas = (appointments ?? []).filter((a) => DateTime.fromISO(a.start_at, { zone: 'utc' }) >= now);
  const historial = (appointments ?? []).filter((a) => DateTime.fromISO(a.start_at, { zone: 'utc' }) < now);
  const tz = tzStatus === 'ready' ? timezone : null;
  const creditosDisponibles = (credits ?? []).filter((c) => c.sessions_used < c.sessions_total);

  return (
    <main className="min-h-screen bg-cream-50 px-4 py-12 max-w-2xl mx-auto space-y-10">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="page-title">Mi cuenta</h1>
        <div className="flex items-center gap-3">
          {tenantSlug && (
            <a href={`/${tenantSlug}/agendar`} className="btn-primary">
              Agendar nueva cita
            </a>
          )}
          <button type="button" onClick={handleLogout} className="btn-ghost text-danger-600">
            Cerrar sesión
          </button>
        </div>
      </section>

      {creditosDisponibles.length > 0 && (
        <section>
          <h2 className="section-title mb-4">Mis créditos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {creditosDisponibles.map((c) => {
              const restantes = c.sessions_total - c.sessions_used;
              return (
                <div key={c.id} className="card">
                  <p className="text-lg text-pine-700 tabular-nums">
                    {restantes} sesión{restantes === 1 ? '' : 'es'} disponible{restantes === 1 ? '' : 's'}
                  </p>
                  <p className="muted mt-1">
                    Vence el {formatFecha(c.expires_at, tz).split(',')[0]}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Próximas citas</h2>
        <div className="mt-4 space-y-3">
          {proximas.length === 0 && <p className="muted">No tienes citas próximas.</p>}
          {proximas.map((appt) => {
            const { badgeClass, label } = getStatusBadge(appt.status);
            return (
              <div key={appt.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-body text-pine-900 tabular-nums">{formatFecha(appt.start_at, tz)}</p>
                  {appt.status === 'confirmed' && appt.video_room_url && (
                    <a href={appt.video_room_url} className="btn-primary mt-2 inline-block">
                      Entrar a la sesión
                    </a>
                  )}
                </div>
                <span className={badgeClass}>{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {upcomingEvents.length > 0 && tenantSlug && (
        <section>
          <h2 className="section-title mb-4">Talleres próximos</h2>
          <div className="space-y-3">
            {upcomingEvents.map((ev) => {
              const start = DateTime.fromISO(ev.start_at, { zone: 'utc' }).setZone(tz ?? 'America/Mexico_City').setLocale('es');
              const seatsLeft = Math.max(ev.capacity - ev.seats_taken, 0);
              const yaRegistrado = registrations?.some((r) => r.live_event_id === ev.id);
              return (
                <div key={ev.id} className="card flex items-center justify-between gap-3">
                  <div>
                    <p className="text-body text-pine-900">{ev.title}</p>
                    <p className="muted">{start.toFormat("cccc d 'de' LLLL, h:mm a")} · {formatPrice(ev.price_cents)}</p>
                  </div>
                  {yaRegistrado ? (
                    <span className="badge-confirmed">Ya te registraste</span>
                  ) : seatsLeft > 0 ? (
                    <a href={`/${tenantSlug}/evento/${ev.id}`} className="btn-secondary whitespace-nowrap">
                      Registrarme
                    </a>
                  ) : (
                    <span className="muted whitespace-nowrap">Cupo lleno</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">Historial</h2>
        <div className="mt-4 space-y-3">
          {historial.length === 0 && <p className="muted">Todavía no tienes sesiones pasadas.</p>}
          {historial.map((appt) => {
            const { badgeClass, label } = getStatusBadge(appt.status);
            return (
              <div key={appt.id} className="card flex items-center justify-between">
                <p className="text-body text-pine-900 tabular-nums">{formatFecha(appt.start_at, tz)}</p>
                <span className={badgeClass}>{label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">Mis registros a eventos</h2>
        <div className="mt-4 space-y-3">
          {(!registrations || registrations.length === 0) && <p className="muted">No tienes registros a eventos.</p>}
          {registrations?.map((reg) => {
            const badge = getEventBadge(reg.payment_status);
            const event = reg.live_events;
            return (
              <div key={reg.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-body text-pine-900">{event?.title ?? 'Evento'}</p>
                  {event?.start_at && (
                    <p className="muted tabular-nums">{formatFecha(event.start_at, tz)}</p>
                  )}
                  {reg.payment_status !== 'pending_payment' && event?.video_room_url && (
                    <a href={event.video_room_url} className="btn-primary mt-2 inline-block">
                      Entrar a la sesión
                    </a>
                  )}
                </div>
                <span className={badge.badgeClass}>{badge.label}</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
