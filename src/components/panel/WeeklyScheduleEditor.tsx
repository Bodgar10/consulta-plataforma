"use client";

import { useState } from "react";
import type { AvailabilityRule } from "@/app/(protected)/agenda/horarios/page";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const TIME_OPTIONS = Array.from({ length: 24 * 6 }, (_, i) => {
  const hours = String(Math.floor(i / 6)).padStart(2, "0");
  const minutes = String((i % 6) * 10).padStart(2, "0");
  return `${hours}:${minutes}`;
});

interface WeeklyScheduleEditorProps {
  rules: AvailabilityRule[];
  onChanged: () => void;
}

interface RuleForm {
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  buffer_minutes: number;
}

const EMPTY_FORM: RuleForm = {
  weekday: 1,
  start_time: "09:00",
  end_time: "14:00",
  slot_minutes: 50,
  buffer_minutes: 10,
};

export function WeeklyScheduleEditor({ rules, onChanged }: WeeklyScheduleEditorProps) {
  const [form, setForm] = useState<RuleForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleEditar(rule: AvailabilityRule) {
    setEditingId(rule.id);
    setForm({
      weekday: rule.weekday,
      start_time: rule.start_time.slice(0, 5),
      end_time: rule.end_time.slice(0, 5),
      slot_minutes: rule.slot_minutes,
      buffer_minutes: rule.buffer_minutes,
    });
    setError(null);
  }

  function handleCancelarEdicion() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError(null);
  }

  async function handleGuardar() {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        // Editar = eliminar la regla vieja + crear la nueva con los valores del form.
        // No hay endpoint PATCH para reglas; este patrón evita crear uno nuevo hoy.
        await fetch(`/api/panel/disponibilidad?kind=rule&id=${editingId}`, { method: "DELETE" });
      }
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
      setEditingId(null);
      onChanged();
    } catch {
      setError("No se pudo guardar la regla");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: string) {
    await fetch(`/api/panel/disponibilidad?kind=rule&id=${id}`, { method: "DELETE" });
    if (editingId === id) handleCancelarEdicion();
    onChanged();
  }

  return (
    <div className="card">
      <h3 className="card-title mb-4">Horario semanal recurrente</h3>

      <div className="flex flex-col gap-2 mb-4">
        {rules.length === 0 && <p className="muted">No hay reglas de horario todavía.</p>}
        {[...rules]
          .sort((a, b) => a.weekday - b.weekday)
          .map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-hair rounded-[7px] px-3 py-2"
            >
              <span className="text-sm text-pine-900">
                {DIAS[rule.weekday]}: {rule.start_time.slice(0, 5)}–{rule.end_time.slice(0, 5)} ·{" "}
                sesiones de {rule.slot_minutes} min, buffer {rule.buffer_minutes} min
              </span>
              <div className="flex items-center gap-2">
                <button className="btn-ghost" onClick={() => handleEditar(rule)}>
                  Editar
                </button>
                <button className="btn-ghost" onClick={() => handleEliminar(rule.id)}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
      </div>

      {editingId && (
        <p className="muted mb-2">
          Editando: {DIAS[rules.find((r) => r.id === editingId)?.weekday ?? 0]}
        </p>
      )}

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
          <select
            className="field"
            value={form.start_time}
            onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label">Fin</label>
          <select
            className="field"
            value={form.end_time}
            onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
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
        <button className="btn-primary" disabled={saving} onClick={handleGuardar}>
          {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar"}
        </button>
        {editingId && (
          <button className="btn-ghost" disabled={saving} onClick={handleCancelarEdicion}>
            Cancelar
          </button>
        )}
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
