"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";

interface Patient {
  id: string;
  full_name: string;
  email: string;
}

interface RecurrenciaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  timezone: string;
}

type PaymentMode = "transfer" | "external" | "credit";

const TIME_OPTIONS = Array.from({ length: 24 * 6 }, (_, i) => {
  const hours = String(Math.floor(i / 6)).padStart(2, "0");
  const minutes = String((i % 6) * 10).padStart(2, "0");
  return `${hours}:${minutes}`;
});

export function RecurrenciaModal({ open, onClose, onCreated, timezone }: RecurrenciaModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [patientId, setPatientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [firstDate, setFirstDate] = useState("");
  const [startTime, setStartTime] = useState("17:00");
  const [endTime, setEndTime] = useState("17:50");
  const [occurrences, setOccurrences] = useState(8);
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("external");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/panel/pacientes")
      .then((res) => res.json())
      .then((data) => setPatients(data.patients ?? []))
      .catch(() => {});
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    setError(null);

    if (!firstDate) {
      setError("Elige la fecha de la primera cita.");
      return;
    }
    if (mode === "existing" && !patientId) {
      setError("Elige un paciente.");
      return;
    }
    if (mode === "new" && (!newName || !newEmail)) {
      setError("Nombre y correo del paciente son obligatorios.");
      return;
    }

    setSaving(true);

    const firstStart = DateTime.fromISO(`${firstDate}T${startTime}`, { zone: timezone });
    const firstEnd = DateTime.fromISO(`${firstDate}T${endTime}`, { zone: timezone });
    // Convención del proyecto: 0=domingo…6=sábado. Luxon: 1=lunes…7=domingo.
    const weekday = firstStart.weekday % 7;

    const body: Record<string, unknown> = {
      start_at: firstStart.toUTC().toISO(),
      end_at: firstEnd.toUTC().toISO(),
      weekday,
      occurrences,
      payment_mode: paymentMode,
    };

    if (mode === "existing") {
      body.patient_id = patientId;
    } else {
      body.full_name = newName;
      body.email = newEmail;
      body.phone = newPhone || null;
    }

    try {
      const res = await fetch("/api/panel/citas/recurrentes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json();

      if (!res.ok) {
        // El backend manda el mensaje completo, con la fecha que chocó incluida —
        // se muestra tal cual, no se reconstruye.
        setError(responseBody.message ?? "No se pudo crear la serie de citas.");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("No se pudo crear la serie de citas.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="card max-w-md w-full max-h-[90vh] overflow-y-auto">
        <h3 className="card-title mb-2">Cita recurrente</h3>
        <p className="muted mb-4">
          Se crean todas de un jalón. Si una fecha choca, no se crea ninguna.
        </p>

        <div className="flex gap-2 mb-4">
          <button
            className={mode === "existing" ? "btn-secondary" : "btn-ghost"}
            onClick={() => setMode("existing")}
          >
            Paciente existente
          </button>
          <button
            className={mode === "new" ? "btn-secondary" : "btn-ghost"}
            onClick={() => setMode("new")}
          >
            Paciente nuevo
          </button>
        </div>

        {mode === "existing" ? (
          <div className="mb-3">
            <label className="field-label">Paciente</label>
            <select className="field" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
              <option value="">Selecciona…</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({p.email})
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-3">
            <div>
              <label className="field-label">Nombre completo</label>
              <input className="field" value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Correo</label>
              <input
                className="field"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Teléfono (opcional)</label>
              <input className="field" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-3 mb-1">
          <div>
            <label className="field-label">Fecha de la primera cita</label>
            <input
              type="date"
              className="field"
              value={firstDate}
              onChange={(e) => setFirstDate(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Inicio</label>
            <select className="field" value={startTime} onChange={(e) => setStartTime(e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Fin</label>
            <select className="field" value={endTime} onChange={(e) => setEndTime(e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Ocurrencias</label>
            <input
              type="number"
              min={1}
              max={52}
              className="field w-20"
              value={occurrences}
              onChange={(e) => setOccurrences(Number(e.target.value))}
            />
          </div>
        </div>
        <p className="muted mb-3">
          Se repite cada{" "}
          {firstDate ? DateTime.fromISO(firstDate, { zone: timezone }).setLocale("es").toFormat("cccc") : "…"}.
        </p>

        <div className="mb-4">
          <label className="field-label">¿Cómo se paga?</label>
          <select
            className="field"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          >
            <option value="external">Efectivo / otro medio externo</option>
            <option value="transfer">Transferencia (ya confirmada)</option>
            <option value="credit">Usa créditos de paquete</option>
          </select>
        </div>

        {error && <p className="field-error mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
            {saving ? "Creando…" : "Crear serie"}
          </button>
        </div>
      </div>
    </div>
  );
}
