"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";

interface Patient {
  id: string;
  full_name: string;
  email: string;
}

interface NuevaCitaModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  timezone: string;
}

type PaymentMode = "transfer" | "external" | "credit";

export function NuevaCitaModal({ open, onClose, onCreated, timezone }: NuevaCitaModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [patientId, setPatientId] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("09:50");
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
    setSaving(true);
    setError(null);

    if (!date) {
      setError("Elige una fecha.");
      setSaving(false);
      return;
    }

    const start_at = DateTime.fromISO(`${date}T${startTime}`, { zone: timezone }).toUTC().toISO();
    const end_at = DateTime.fromISO(`${date}T${endTime}`, { zone: timezone }).toUTC().toISO();

    const body: Record<string, unknown> = {
      start_at,
      end_at,
      payment_mode: paymentMode,
    };

    if (mode === "existing") {
      if (!patientId) {
        setError("Elige un paciente.");
        setSaving(false);
        return;
      }
      body.patient_id = patientId;
    } else {
      if (!newName || !newEmail) {
        setError("Nombre y correo del paciente son obligatorios.");
        setSaving(false);
        return;
      }
      body.full_name = newName;
      body.email = newEmail;
      body.phone = newPhone || null;
    }

    try {
      const res = await fetch("/api/panel/citas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json();

      if (!res.ok) {
        setError(responseBody.message ?? "No se pudo crear la cita.");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("No se pudo crear la cita.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="card max-w-md w-full">
        <h3 className="card-title mb-4">Nueva cita</h3>

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

        <div className="flex gap-3 mb-3">
          <div className="flex-1">
            <label className="field-label">Fecha</label>
            <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Inicio</label>
            <input
              type="time"
              className="field"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label">Fin</label>
            <input type="time" className="field" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>

        <div className="mb-4">
          <label className="field-label">¿Cómo se pagó?</label>
          <select
            className="field"
            value={paymentMode}
            onChange={(e) => setPaymentMode(e.target.value as PaymentMode)}
          >
            <option value="external">Efectivo / otro medio externo</option>
            <option value="transfer">Transferencia (ya confirmada)</option>
            <option value="credit">Usa un crédito de paquete</option>
          </select>
        </div>

        {error && <p className="field-error mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
            {saving ? "Creando…" : "Crear cita"}
          </button>
        </div>
      </div>
    </div>
  );
}
