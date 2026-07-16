"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DateTime } from "luxon";
import { AgendaView } from "@/components/panel/AgendaView";
import { NuevaCitaModal } from "@/components/panel/NuevaCitaModal";
import { RecurrenciaModal } from "@/components/panel/RecurrenciaModal";
import { useTour } from "@/lib/tour/useTour";

const AGENDA_TOUR_BASE_STEPS = [
  {
    element: "[data-tour='nueva-cita']",
    popover: {
      title: "Crear una cita nueva",
      description: "Aquí agregas una cita a mano — para un paciente que ya tienes o uno nuevo.",
    },
  },
  {
    element: "[data-tour='cita-recurrente']",
    popover: {
      title: "Citas que se repiten",
      description: "Si un paciente viene cada semana, aquí creas todas sus citas de un jalón.",
    },
  },
  {
    element: "[data-tour='semana-nav']",
    popover: {
      title: "Cambiar de semana",
      description: "Con estos botones te mueves a la semana anterior o siguiente.",
    },
  },
];

const AGENDA_TOUR_ROW_STEPS = [
  {
    element: "[data-tour='appointment-badge']",
    popover: {
      title: "El estado de cada cita",
      description:
        "Esta etiqueta te dice si falta que paguen (Esperando pago), si ya está lista (Confirmada), si hay que revisar una transferencia (Por verificar), o si se canceló.",
    },
  },
  {
    element: "[data-tour='appointment-row']",
    popover: {
      title: "Ver el link de la sesión",
      description: "Toca cualquier cita para ver el enlace de la videollamada, si ya está lista.",
    },
  },
];

const AGENDA_TOUR_REAGENDAR_STEP = {
  element: "[data-tour='appointment-reagendar']",
  popover: {
    title: "Cambiar fecha u hora",
    description: "Aquí reagendas o cancelas una cita. Al abrirlo la primera vez, te explico cómo funciona.",
  },
};

const CANCELABLE_STATUSES_FOR_TOUR = ["pending_payment", "pending_verification", "confirmed"];

const AGENDA_TOUR_EMPTY_STEP = {
  popover: {
    title: "Cuando tengas citas",
    description:
      "Esta semana no tiene citas todavía. En cuanto agendes una (o un paciente reserve), aparecerá aquí con su estado y las opciones para reagendar o cancelar.",
  },
};

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

  // Los pasos que apuntan a una fila solo existen si hay citas renderizadas;
  // driver.js saltaría los pasos sin elemento, dejando el tour incompleto en
  // silencio. Se arman aquí (no como constante fija) para reflejar el estado real.
  const hasVisibleAppointment = appointments.some((a) =>
    DateTime.fromISO(a.start_at, { zone: "utc" }).setZone(timezone ?? "utc").hasSame(weekStart, "week")
  );
  const hasCancelableAppointment = appointments.some((a) =>
    CANCELABLE_STATUSES_FOR_TOUR.includes(a.status)
  );
  const tourSteps = hasVisibleAppointment
    ? [
        ...AGENDA_TOUR_BASE_STEPS,
        ...AGENDA_TOUR_ROW_STEPS,
        ...(hasCancelableAppointment ? [AGENDA_TOUR_REAGENDAR_STEP] : []),
      ]
    : [...AGENDA_TOUR_BASE_STEPS, AGENDA_TOUR_EMPTY_STEP];
  const { startTour } = useTour(tourSteps);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <h1 className="page-title">Agenda</h1>
          <button type="button" className="btn-ghost self-start" onClick={startTour}>
            ¿Cómo funciona esto?
          </button>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 md:flex-wrap">
          <button
            data-tour="nueva-cita"
            className="btn-primary whitespace-nowrap shrink-0"
            disabled={!ready}
            onClick={() => setShowNuevaCita(true)}
          >
            Nueva cita
          </button>
          <button
            data-tour="cita-recurrente"
            className="btn-secondary whitespace-nowrap shrink-0"
            disabled={!ready}
            onClick={() => setShowRecurrencia(true)}
          >
            Cita recurrente
          </button>
          <div data-tour="semana-nav" className="flex gap-2">
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
