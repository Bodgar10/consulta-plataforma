"use client";

import { useCallback, useEffect, useState } from "react";
import { WeeklyScheduleEditor } from "@/components/panel/WeeklyScheduleEditor";
import { BlocksEditor } from "@/components/panel/BlocksEditor";

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
    </div>
  );
}
