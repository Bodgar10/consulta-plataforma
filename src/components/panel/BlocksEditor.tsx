"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import type { AvailabilityBlock } from "@/app/(protected)/agenda/horarios/page";

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

interface BlocksEditorProps {
  blocks: AvailabilityBlock[];
  onChanged: () => void;
}

interface NewBlockForm {
  start_at: string;
  end_at: string;
  reason: string;
}

const EMPTY_FORM: NewBlockForm = { start_at: "", end_at: "", reason: "" };

export function BlocksEditor({ blocks, onChanged }: BlocksEditorProps) {
  const [form, setForm] = useState<NewBlockForm>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgregar() {
    if (!form.start_at || !form.end_at) {
      setError("Completa desde y hasta.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/panel/disponibilidad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "block",
          start_at: new Date(form.start_at).toISOString(),
          end_at: new Date(form.end_at).toISOString(),
          reason: form.reason || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar el bloqueo");
        return;
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
      onChanged();
    } catch {
      setError("No se pudo guardar el bloqueo");
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(id: string) {
    await fetch(`/api/panel/disponibilidad?kind=block&id=${id}`, { method: "DELETE" });
    onChanged();
  }

  const sortedBlocks = [...blocks].sort((a, b) => a.start_at.localeCompare(b.start_at));

  return (
    <div className="card">
      <h3 className="card-title mb-4">Bloqueos puntuales (vacaciones, ausencias)</h3>

      {sortedBlocks.length === 0 && (
        <p className="muted mb-4">No hay bloqueos programados.</p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-5">
        {sortedBlocks.map((block) => {
          const start = DateTime.fromISO(block.start_at);
          const end = DateTime.fromISO(block.end_at);
          return (
            <div key={block.id} className="bg-cream-0 border-hair rounded-[10px] p-4">
              <p className="text-pine-900 mb-1">
                {start.setLocale("es").toFormat("d 'de' LLLL, HH:mm")}
              </p>
              <p className="muted mb-3">
                hasta {end.setLocale("es").toFormat("d 'de' LLLL, HH:mm")}
                {block.reason ? ` · ${block.reason}` : ""}
              </p>
              <button
                className="btn-ghost text-danger-600 flex items-center gap-1.5"
                onClick={() => handleEliminar(block.id)}
              >
                <IconTrash /> Eliminar
              </button>
            </div>
          );
        })}
      </div>

      {!showForm && (
        <button data-tour="bloqueo-nuevo" className="btn-primary" onClick={() => setShowForm(true)}>
          + Agregar bloqueo
        </button>
      )}

      {showForm && (
        <div className="bg-cream-0 border-hair rounded-[10px] p-5">
          <p className="card-title mb-4">Nuevo bloqueo</p>
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-end gap-4">
            <div>
              <label className="field-label">Desde</label>
              <input
                type="datetime-local"
                className="field"
                value={form.start_at}
                onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
              />
            </div>
            <div>
              <label className="field-label">Hasta</label>
              <input
                type="datetime-local"
                className="field"
                value={form.end_at}
                onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
              />
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="field-label">Motivo (opcional)</label>
              <input
                type="text"
                className="field"
                placeholder="Vacaciones"
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4">
            <button className="btn-primary" disabled={saving} onClick={handleAgregar}>
              {saving ? "Agregando…" : "Agregar"}
            </button>
            <button
              className="btn-ghost"
              disabled={saving}
              onClick={() => {
                setForm(EMPTY_FORM);
                setShowForm(false);
                setError(null);
              }}
            >
              Cancelar
            </button>
          </div>
          {error && <p className="field-error mt-2">{error}</p>}
        </div>
      )}
    </div>
  );
}
