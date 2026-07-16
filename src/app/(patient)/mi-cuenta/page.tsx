'use client';

import { useEffect, useState } from 'react';
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

function formatFecha(iso: string, timeZone: string | null) {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  if (!timeZone) return dt.setLocale('es').toFormat("d 'de' LLLL, h:mm a") + ' (zona pendiente)';
  return dt.setZone(timeZone).setLocale('es').toFormat("d 'de' LLLL, h:mm a");
}

export default function MiCuentaPage() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[] | null>(null);
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
    ]).then(([apptRes, regRes]) => {
      setAppointments((apptRes.data as Appointment[]) ?? []);
      setRegistrations((regRes.data as EventRegistration[]) ?? []);
      setLoading(false);
    });
  }, []);

  // Aproximación documentada: se usa la zona de la primera cita. /mi-cuenta
  // es cross-tenant (un correo puede ser paciente de varios tenants); lo
  // correcto a futuro es zona por-fila, no una zona global de la página.
  // Deuda anotada, no resuelta en este prompt.
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

  return (
    <main className="min-h-screen bg-cream-50 px-4 py-12 max-w-2xl mx-auto space-y-10">
      <section>
        <h1 className="page-title">Mi cuenta</h1>
      </section>

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
        <h2 className="section-title">Eventos</h2>
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
