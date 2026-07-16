"use client";

import { useState } from "react";
import type { AvailabilityRule } from "@/app/(protected)/agenda/horarios/page";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

const TIME_OPTIONS = Array.from({ length: 24 * 6 }, (_, i) => {
  const hours = String(Math.floor(i / 6)).padStart(2, "0");
  const minutes = String((i % 6) * 10).padStart(2, "0");
  return `${hours}:${minutes}`;
});

function IconEdit() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

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
  const [showForm, setShowForm] = useState(false);
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
    setShowForm(true);
    setError(null);
  }

  function handleCerrarFormulario() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setError(null);
  }

  async function handleGuardar() {
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fetch(`/api/panel/disponibilidad?kind=rule&id=${editingId}`, { method: "DELETE" });
      }
      const res = await fetch("/api/panel/disponibilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "rule", ...form }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar el horario");
        return;
      }
      handleCerrarFormulario();
      onChanged();
    } catch {
      setError("No se pudo guardar el horario");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: string) {
    await fetch(`/api/panel/disponibilidad?kind=rule&id=${id}`, { method: "DELETE" });
    if (editingId === id) handleCerrarFormulario();
    onChanged();
  }

  const sortedRules = [...rules].sort((a, b) => a.weekday - b.weekday);

  return (
    <div className="card">
      <h3 className="card-title mb-4">Horario semanal recurrente</h3>

      {sortedRules.length === 0 && (
        <p className="muted mb-4">Todavía no has configurado ningún horario.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {sortedRules.map((rule) => (
          <div key={rule.id} className="bg-cream-0 border-hair rounded-[10px] p-4">
            <p className="card-title mb-1">{DIAS[rule.weekday]}</p>
            <p className="text-lg tabular-nums text-pine-700 mb-1">
              {rule.start_time.slice(0, 5)} – {rule.end_time.slice(0, 5)}
            </p>
            <p className="muted mb-3">
              Sesiones de {rule.slot_minutes} min · {rule.buffer_minutes} min de descanso
            </p>
            <div className="flex items-center gap-2">
              <button
                className="btn-secondary flex items-center gap-1.5"
                onClick={() => handleEditar(rule)}
              >
                <IconEdit /> Editar
              </button>
              <button
                className="btn-ghost text-danger-600 flex items-center gap-1.5"
                onClick={() => handleEliminar(rule.id)}
              >
                <IconTrash /> Eliminar
              </button>
            </div>
          </div>
        ))}
      </div>

      {!showForm && (
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          + Agregar horario
        </button>
      )}

      {showForm && (
        <div className="bg-cream-0 border-hair rounded-[10px] p-5">
          <p className="card-title mb-4">
            {editingId ? `Editando: ${DIAS[form.weekday]}` : "Nuevo horario"}
          </p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-4">
            <div>
              <label className="field-label">Día</label>
              <select
                className="field"
                value={form.weekday}
                onChange={(e) => setForm((f) => ({ ...f, weekday: Number(e.target.value) }))}
              >
                {DIAS.map((dia, idx) => (
                  <option key={idx} value={idx}>{dia}</option>
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
                onChange={(e) => setForm((f) => ({ ...f, slot_minutes: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="field-label">Descanso (min)</label>
              <input
                type="number"
                className="field w-24"
                value={form.buffer_minutes}
                onChange={(e) => setForm((f) => ({ ...f, buffer_minutes: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button className="btn-primary" disabled={saving} onClick={handleGuardar}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Agregar"}
            </button>
            <button className="btn-ghost" disabled={saving} onClick={handleCerrarFormulario}>
              Cancelar
            </button>
          </div>
          {error && <p className="field-error mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
