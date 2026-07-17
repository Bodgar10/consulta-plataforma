"use client";

import { useCallback, useEffect, useState } from "react";
import { WeeklyScheduleEditor } from "@/components/panel/WeeklyScheduleEditor";
import { BlocksEditor } from "@/components/panel/BlocksEditor";
import { useTour } from "@/lib/tour/useTour";
import { TourFab } from "@/components/panel/TourFab";

const HORARIOS_TOUR_BASE_STEPS = [
  {
    element: "[data-tour='horario-nuevo']",
    popover: {
      title: "Agregar un horario",
      description: "Aquí defines un día, la hora en que empiezas y terminas de recibir citas ese día, y cuánto dura cada sesión.",
    },
  },
  {
    element: "[data-tour='bloqueo-nuevo']",
    popover: {
      title: "Bloquear un día",
      description: "Si vas a tener vacaciones o un día que no puedes atender, agrégalo aquí para que nadie pueda agendar en esas fechas.",
    },
  },
];

const HORARIOS_TOUR_CARD_STEPS = [
  {
    element: "[data-tour='horario-card']",
    popover: {
      title: "Tus horarios actuales",
      description: "Cada tarjeta es un día con su horario. Si algo cambió, no lo borres — usa Editar.",
    },
  },
  {
    element: "[data-tour='horario-editar']",
    popover: {
      title: "Cambiar un horario",
      description: "Aquí ajustas la hora de inicio, fin, o la duración de las sesiones de ese día.",
    },
  },
];

const HORARIOS_TOUR_EMPTY_STEP = {
  popover: {
    title: "Todavía no tienes horarios",
    description: "Usa el botón de abajo para agregar tu primer horario — sin eso, nadie va a poder ver espacios disponibles para agendar.",
  },
};

export interface AvailabilityRule {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
}

export interface AvailabilityBlock {
  id: string;
  start_at: string;
  end_at: string;
  reason: string | null;
}

export default function HorariosPage() {
  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [blocks, setBlocks] = useState<AvailabilityBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/panel/disponibilidad")
      .then(async (res) => {
        if (!res.ok) throw new Error("error_desconocido");
        return res.json();
      })
      .then((data) => {
        setRules(data.rules ?? []);
        setBlocks(data.blocks ?? []);
      })
      .catch(() => setError("No se pudo cargar la disponibilidad"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="page-title">Horarios</h1>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <>
          <WeeklyScheduleEditor rules={rules} onChanged={cargar} />
          <BlocksEditor blocks={blocks} onChanged={cargar} />
        </>
      )}
      {!loading && <HorariosTourFab hasRules={rules.length > 0} />}
    </div>
  );
}

function HorariosTourFab({ hasRules }: { hasRules: boolean }) {
  const steps = hasRules
    ? [...HORARIOS_TOUR_CARD_STEPS, ...HORARIOS_TOUR_BASE_STEPS]
    : [HORARIOS_TOUR_EMPTY_STEP, ...HORARIOS_TOUR_BASE_STEPS];
  const { startTour } = useTour(steps);
  return <TourFab onClick={startTour} />;
}
