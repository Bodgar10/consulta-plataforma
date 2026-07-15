"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { AgendaView } from "@/components/panel/AgendaView";
import { NuevaCitaModal } from "@/components/panel/NuevaCitaModal";
import { RecurrenciaModal } from "@/components/panel/RecurrenciaModal";

export interface PanelAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  payment_mode: string;
  video_room_url: string | null;
  created_by: "patient" | "professional";
  recurrence_group_id: string | null;
  patient: { id: string; full_name: string };
}

export default function AgendaPage() {
  // Zona del tenant: llega del mismo fetch de /api/panel/agenda (no fallback CDMX).
  const [timezone, setTimezone] = useState<string | null>(null);
  // Provisional en zona local del navegador para el primer fetch; se recalcula a la
  // zona real del tenant una sola vez cuando llega (abajo), sin re-fetch si es la misma.
  const [weekStart, setWeekStart] = useState<DateTime>(() => DateTime.now().startOf("week"));
  const [appointments, setAppointments] = useState<PanelAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showNuevaCita, setShowNuevaCita] = useState(false);
  const [showRecurrencia, setShowRecurrencia] = useState(false);
  const tzApplied = useRef(false);

  const weekEnd = useMemo(() => weekStart.plus({ days: 7 }), [weekStart]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const from = weekStart.toUTC().toISO();
    const to = weekEnd.toUTC().toISO();

    fetch(`/api/panel/agenda?from=${encodeURIComponent(from!)}&to=${encodeURIComponent(to!)}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "error_desconocido");
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setAppointments(data.appointments ?? []);
        setTimezone(data.timezone ?? null);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "No se pudo cargar la agenda");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [weekStart, weekEnd, reloadToken]);

  // Al conocer la zona real del tenant, reencuadra la semana a esa zona una sola vez.
  // Si coincide con la semana local (caso común), no reasigna -> no dispara re-fetch.
  useEffect(() => {
    if (timezone && !tzApplied.current) {
      tzApplied.current = true;
      const tzWeek = DateTime.now().setZone(timezone).startOf("week");
      setWeekStart((prev) => (prev.hasSame(tzWeek, "day") ? prev : tzWeek));
    }
  }, [timezone]);

  const ready = !!timezone;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="page-title">Agenda</h1>
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 md:flex-wrap">
          <button
            className="btn-primary whitespace-nowrap shrink-0"
            disabled={!ready}
            onClick={() => setShowNuevaCita(true)}
          >
            Nueva cita
          </button>
          <button
            className="btn-secondary whitespace-nowrap shrink-0"
            disabled={!ready}
            onClick={() => setShowRecurrencia(true)}
          >
            Cita recurrente
          </button>
          <button
            className="btn-secondary whitespace-nowrap shrink-0"
            onClick={() => setWeekStart((d) => d.minus({ weeks: 1 }))}
          >
            Semana anterior
          </button>
          <button
            className="btn-secondary whitespace-nowrap shrink-0"
            onClick={() => setWeekStart((d) => d.plus({ weeks: 1 }))}
          >
            Semana siguiente
          </button>
        </div>
      </div>

      {timezone && (
        <>
          <NuevaCitaModal
            open={showNuevaCita}
            onClose={() => setShowNuevaCita(false)}
            onCreated={() => setReloadToken((t) => t + 1)}
            timezone={timezone}
          />
          <RecurrenciaModal
            open={showRecurrencia}
            onClose={() => setShowRecurrencia(false)}
            onCreated={() => setReloadToken((t) => t + 1)}
            timezone={timezone}
          />
        </>
      )}

      <p className="muted">
        {weekStart.setLocale("es").toFormat("d 'de' MMMM")} — {weekEnd.minus({ days: 1 }).setLocale("es").toFormat("d 'de' MMMM yyyy")}
      </p>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {!error && (loading || !timezone) && <p className="muted">Cargando agenda…</p>}

      {!error && !loading && timezone && (
        <AgendaView
          appointments={appointments}
          timezone={timezone}
          weekStart={weekStart}
          onActionComplete={() => setReloadToken((t) => t + 1)}
        />
      )}
    </div>
  );
}
