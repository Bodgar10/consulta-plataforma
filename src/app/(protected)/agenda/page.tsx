"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { AgendaView } from "@/components/panel/AgendaView";
import { NuevaCitaModal } from "@/components/panel/NuevaCitaModal";
import { RecurrenciaModal } from "@/components/panel/RecurrenciaModal";

// TODO: reemplazar por la zona real del tenant en cuanto exista un hook/contexto
// que la exponga en el plano de app (ver ⚠️ en el índice de este sprint). Hasta
// entonces, fallback documentado — NUNCA hardcodear un offset numérico como -6.
const FALLBACK_TENANT_TIMEZONE = "America/Mexico_City";

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
  const [weekStart, setWeekStart] = useState(() =>
    DateTime.now().setZone(FALLBACK_TENANT_TIMEZONE).startOf("week")
  );
  const [appointments, setAppointments] = useState<PanelAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [showNuevaCita, setShowNuevaCita] = useState(false);
  const [showRecurrencia, setShowRecurrencia] = useState(false);

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
        if (!cancelled) setAppointments(data.appointments ?? []);
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title">Agenda</h1>
        <div className="flex gap-2">
          <button className="btn-primary" onClick={() => setShowNuevaCita(true)}>
            Nueva cita
          </button>
          <button className="btn-secondary" onClick={() => setShowRecurrencia(true)}>
            Cita recurrente
          </button>
          <button
            className="btn-secondary"
            onClick={() => setWeekStart((d) => d.minus({ weeks: 1 }))}
          >
            Semana anterior
          </button>
          <button
            className="btn-secondary"
            onClick={() => setWeekStart((d) => d.plus({ weeks: 1 }))}
          >
            Semana siguiente
          </button>
        </div>
      </div>

      <NuevaCitaModal
        open={showNuevaCita}
        onClose={() => setShowNuevaCita(false)}
        onCreated={() => setReloadToken((t) => t + 1)}
        timezone={FALLBACK_TENANT_TIMEZONE}
      />
      <RecurrenciaModal
        open={showRecurrencia}
        onClose={() => setShowRecurrencia(false)}
        onCreated={() => setReloadToken((t) => t + 1)}
        timezone={FALLBACK_TENANT_TIMEZONE}
      />

      <p className="muted">
        {weekStart.toFormat("d 'de' MMMM")} — {weekEnd.minus({ days: 1 }).toFormat("d 'de' MMMM yyyy")}
      </p>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando agenda…</p>
      ) : (
        <AgendaView
          appointments={appointments}
          timezone={FALLBACK_TENANT_TIMEZONE}
          weekStart={weekStart}
          onActionComplete={() => setReloadToken((t) => t + 1)}
        />
      )}
    </div>
  );
}
