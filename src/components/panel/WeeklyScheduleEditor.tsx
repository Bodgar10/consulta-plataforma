"use client";

import { useState } from "react";
import type { AvailabilityRule } from "@/app/(protected)/agenda/horarios/page";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

interface WeeklyScheduleEditorProps {
  rules: AvailabilityRule[];
  onChanged: () => void;
}

interface NewRuleForm {
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
}

const EMPTY_FORM: NewRuleForm = {
  weekday: 1,
  start_time: "09:00",
  end_time: "14:00",
  slot_minutes: 50,
  buffer_minutes: 10,
};

export function WeeklyScheduleEditor({ rules, onChanged }: WeeklyScheduleEditorProps) {
  const [form, setForm] = useState<NewRuleForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgregar() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/disponibilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "rule", ...form }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar la regla");
        return;
      }
      setForm(EMPTY_FORM);
      onChanged();
    } catch {
      setError("No se pudo guardar la regla");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: string) {
    await fetch(`/api/panel/disponibilidad?kind=rule&id=${id}`, { method: "DELETE" });
    onChanged();
  }

  return (
    <div className="card">
      <h3 className="card-title mb-4">Horario semanal recurrente</h3>

      <div className="flex flex-col gap-2 mb-4">
        {rules.length === 0 && <p className="muted">No hay reglas de horario todavía.</p>}
        {rules
          .sort((a, b) => a.weekday - b.weekday)
          .map((rule) => (
            <div
              key={rule.id}
              className="flex items-center justify-between border-hair rounded-[7px] px-3 py-2"
            >
              <span className="text-sm text-pine-900">
                {DIAS[rule.weekday]}: {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)} ·{" "}
                sesiones de {rule.slot_minutes} min, buffer {rule.buffer_minutes} min
              </span>
              <button className="btn-ghost" onClick={() => handleEliminar(rule.id)}>
                Eliminar
              </button>
            </div>
          ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label">Día</label>
          <select
            className="field"
            value={form.weekday}
            onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
          >
            {DIAS.map((dia, idx) => (
              <option key={idx} value={idx}>
                {dia}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Inicio</label>
          <input
            type="time"
            className="field"
            value={form.start_time}
            onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
          />
        </div>
        <div>
          <label className="field-label">Fin</label>
          <input
            type="time"
            className="field"
            value={form.end_time}
            onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
          />
        </div>
        <div>
          <label className="field-label">Duración sesión (min)</label>
          <input
            type="number"
            className="field w-24"
            value={form.slot_minutes}
            onChange={(e) =>
              setForm((f) => ({ ...f, slot_minutes: Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <label className="field-label">Buffer (min)</label>
          <input
            type="number"
            className="field w-24"
            value={form.buffer_minutes}
            onChange={(e) =>
              setForm((f) => ({ ...f, buffer_minutes: Number(e.target.value) }))
            }
          />
        </div>
        <button className="btn-primary" disabled={saving} onClick={handleAgregar}>
          {saving ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
