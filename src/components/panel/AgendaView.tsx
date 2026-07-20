"use client";

import { useState } from "react";
import { DateTime } from "luxon";
import { getStatusBadge } from "@/lib/panel/status-badge";
import type { PanelAppointment } from "@/app/(protected)/agenda/page";

interface AgendaViewProps {
  appointments: PanelAppointment[];
  timezone: string;
  weekStart: DateTime;
  onActionComplete: () => void;
}

const CANCELABLE_STATUSES = ["pending_payment", "pending_verification", "confirmed"];

const TIME_OPTIONS = Array.from({ length: 24 * 6 }, (_, i) => {
  const hours = String(Math.floor(i / 6)).padStart(2, "0");
  const minutes = String((i % 6) * 10).padStart(2, "0");
  return `${hours}:${minutes}`;
});

export function AgendaView({ appointments, timezone, weekStart, onActionComplete }: AgendaViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => weekStart.plus({ days: i }));

  const byDay = days.map((day) => {
    const dayAppointments = appointments
      .filter((a) => {
        const start = DateTime.fromISO(a.start_at, { zone: "utc" }).setZone(timezone);
        return start.hasSame(day, "day");
      })
      .sort((a, b) => a.start_at.localeCompare(b.start_at));
    return { day, dayAppointments };
  });

  if (appointments.length === 0) {
    return (
      <div className="card">
        <p className="muted">No hay citas esta semana.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {byDay
        .filter(({ dayAppointments }) => dayAppointments.length > 0)
        .map(({ day, dayAppointments }) => (
          <div key={day.toISODate()} className="card">
            <h3 className="card-title mb-3">{day.setLocale("es").toFormat("cccc d 'de' MMMM")}</h3>
            <div className="flex flex-col gap-2">
              {dayAppointments.map((appt) => (
                <AppointmentRow
                  key={appt.id}
                  appointment={appt}
                  timezone={timezone}
                  onActionComplete={onActionComplete}
                />
              ))}
            </div>
          </div>
        ))}
    </div>
  );
}

interface AppointmentRowProps {
  appointment: PanelAppointment;
  timezone: string;
  onActionComplete: () => void;
}

function AppointmentRow({ appointment, timezone, onActionComplete }: AppointmentRowProps) {
  const [reagendando, setReagendando] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [showReagendarTip, setShowReagendarTip] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const start = DateTime.fromISO(appointment.start_at, { zone: "utc" }).setZone(timezone);
  const end = DateTime.fromISO(appointment.end_at, { zone: "utc" }).setZone(timezone);
  const { badgeClass, label } = getStatusBadge(appointment.status);
  const canCancel = CANCELABLE_STATUSES.includes(appointment.status);

  async function handleCancelar() {
    if (!confirm("¿Cancelar esta cita?")) return;
    setBusy(true);
    setRowError(null);
    try {
      const res = await fetch(`/api/panel/agenda/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      const body = await res.json();
      if (!res.ok) {
        setRowError(body.message ?? "No se pudo cancelar la cita.");
        return;
      }
      onActionComplete();
    } catch {
      setRowError("No se pudo cancelar la cita.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCancelarSerie() {
    if (!appointment.recurrence_group_id) return;
    if (!confirm("¿Cancelar todas las citas futuras de esta serie?")) return;
    setBusy(true);
    setRowError(null);
    try {
      const res = await fetch(
        `/api/panel/citas/recurrentes/${appointment.recurrence_group_id}/cancelar-futuras`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        setRowError(body.message ?? "No se pudo cancelar la serie.");
        return;
      }
      onActionComplete();
    } catch {
      setRowError("No se pudo cancelar la serie.");
    } finally {
      setBusy(false);
    }
  }

  async function handleGuardarReagendo() {
    if (!newDate || !newStart || !newEnd) {
      setRowError("Completa fecha, inicio y fin.");
      return;
    }
    setBusy(true);
    setRowError(null);

    const start_at = DateTime.fromISO(`${newDate}T${newStart}`, { zone: timezone }).toUTC().toISO();
    const end_at = DateTime.fromISO(`${newDate}T${newEnd}`, { zone: timezone }).toUTC().toISO();

    try {
      const res = await fetch(`/api/panel/agenda/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start_at, end_at }),
      });
      const body = await res.json();
      if (!res.ok) {
        setRowError(
          body.error === "overlap"
            ? body.message ?? "Ese horario ya está ocupado."
            : body.message ?? "No se pudo reagendar."
        );
        return;
      }
      setReagendando(false);
      onActionComplete();
    } catch {
      setRowError("No se pudo reagendar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-hair rounded-[7px] px-3 py-2">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div
          data-tour="appointment-row"
          role="button"
          tabIndex={0}
          className="flex flex-wrap items-center gap-x-3 gap-y-1 cursor-pointer"
          onClick={() => setShowLink((v) => !v)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setShowLink((v) => !v);
            }
          }}
        >
          <span className="text-sm tabular-nums text-pine-700 shrink-0">
            {start.toFormat("HH:mm")}–{end.toFormat("HH:mm")}
          </span>
          <span className="text-sm text-pine-900">{appointment.patient.full_name}</span>
          <span data-tour="appointment-badge" className={badgeClass}>{label}</span>
          {appointment.workshop_title && (
            <span className="muted text-xs">
              · Cita por compra del taller: {appointment.workshop_title}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canCancel && !reagendando && (
            <>
              <button
                data-tour="appointment-reagendar"
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  setNewDate(start.toFormat("yyyy-MM-dd"));
                  setNewStart(start.toFormat("HH:mm"));
                  setNewEnd(end.toFormat("HH:mm"));
                  setReagendando(true);
                  if (!localStorage.getItem("tour_reagendar_visto")) {
                    setShowReagendarTip(true);
                    localStorage.setItem("tour_reagendar_visto", "1");
                  }
                }}
              >
                Reagendar
              </button>
              <button className="btn-ghost" disabled={busy} onClick={handleCancelar}>
                Cancelar
              </button>
            </>
          )}
          {appointment.recurrence_group_id && (
            <button className="btn-ghost" disabled={busy} onClick={handleCancelarSerie}>
              Cancelar serie
            </button>
          )}
        </div>
      </div>

      {reagendando && (
        <div className="flex flex-wrap items-end gap-2 mt-2 pt-2 border-hair">
          {showReagendarTip && (
            <div className="w-full bg-pine-50 border-hair rounded-[7px] px-3 py-2 mb-1">
              <p className="text-sm text-pine-700">
                Aquí eliges la nueva fecha y hora, y le das <strong>Guardar</strong> para confirmar el cambio.
              </p>
              <button
                type="button"
                className="btn-ghost mt-1"
                onClick={() => setShowReagendarTip(false)}
              >
                Entendido
              </button>
            </div>
          )}
          <div>
            <label className="field-label">Fecha</label>
            <input type="date" className="field" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Inicio</label>
            <select className="field" value={newStart} onChange={(e) => setNewStart(e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label">Fin</label>
            <select className="field" value={newEnd} onChange={(e) => setNewEnd(e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <button className="btn-primary" disabled={busy} onClick={handleGuardarReagendo}>
            Guardar
          </button>
          <button className="btn-ghost" disabled={busy} onClick={() => setReagendando(false)}>
            Cancelar
          </button>
        </div>
      )}

      {showLink && (
        <div className="mt-2 pt-2 border-hair">
          {appointment.status === "cancelled" ? (
            <p className="muted">Esta cita fue cancelada.</p>
          ) : appointment.video_room_url ? (
            <a
              href={appointment.video_room_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              Unirme a la sesión
            </a>
          ) : (
            <p className="muted">
              El enlace de la videollamada se genera cuando se confirme el pago de la cita.
            </p>
          )}
        </div>
      )}

      {rowError && <p className="field-error mt-1">{rowError}</p>}
    </div>
  );
}
