"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import type { AvailabilityBlock } from "@/app/(protected)/agenda/horarios/page";

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
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAgregar() {
    if (!form.start_at || !form.end_at) return;

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

  return (
    <div className="card">
      <h3 className="card-title mb-4">Bloqueos puntuales (vacaciones, ausencias)</h3>

      <div className="flex flex-col gap-2 mb-4">
        {blocks.length === 0 && <p className="muted">No hay bloqueos programados.</p>}
        {blocks
          .sort((a, b) => a.start_at.localeCompare(b.start_at))
          .map((block) => {
            const start = DateTime.fromISO(block.start_at);
            const end = DateTime.fromISO(block.end_at);
            return (
              <div
                key={block.id}
                className="flex items-center justify-between border-hair rounded-[7px] px-3 py-2"
              >
                <span className="text-sm text-pine-900">
                  {start.toFormat("d LLL yyyy HH:mm")} – {end.toFormat("d LLL yyyy HH:mm")}
                  {block.reason ? ` · ${block.reason}` : ""}
                </span>
                <button className="btn-ghost" onClick={() => handleEliminar(block.id)}>
                  Eliminar
                </button>
              </div>
            );
          })}
      </div>

      <div className="flex flex-wrap items-end gap-3">
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
        <button className="btn-primary" disabled={saving} onClick={handleAgregar}>
          {saving ? "Agregando…" : "Agregar"}
        </button>
      </div>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}
