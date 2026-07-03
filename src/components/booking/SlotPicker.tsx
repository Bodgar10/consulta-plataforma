"use client";

import { useState } from "react";

export interface Slot {
  start_at: string; // ISO, ya en hora local del tenant (lo resuelve el API de Opus)
  end_at: string;
  available: boolean;
}

interface SlotPickerProps {
  slotsByDay: Record<string, Slot[]>; // key: "2026-07-08" (YYYY-MM-DD local)
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
  tenantTimezone: string; // zona IANA del tenant, ej. "America/Mexico_City"
}

export default function SlotPicker({
  slotsByDay,
  selectedSlot,
  onSelectSlot,
  tenantTimezone,
}: SlotPickerProps) {
  const days = Object.keys(slotsByDay).sort();
  const [activeDay, setActiveDay] = useState<string>(days[0] ?? "");

  if (days.length === 0) {
    return (
      <div className="card">
        <p className="muted">No hay horarios disponibles por ahora.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-5">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((day) => (
          <button
            key={day}
            onClick={() => setActiveDay(day)}
            className={`slot whitespace-nowrap ${
              activeDay === day ? "slot--active" : ""
            }`}
          >
            {new Date(day + "T00:00:00").toLocaleDateString("es-MX", {
              weekday: "short",
              day: "numeric",
              month: "short",
              timeZone: tenantTimezone,
            })}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {(slotsByDay[activeDay] ?? []).map((slot) => {
          const isActive = selectedSlot?.start_at === slot.start_at;
          return (
            <button
              key={slot.start_at}
              disabled={!slot.available}
              onClick={() => slot.available && onSelectSlot(slot)}
              className={`slot ${isActive ? "slot--active" : ""} ${
                !slot.available ? "slot--taken" : ""
              }`}
            >
              {new Date(slot.start_at).toLocaleTimeString("es-MX", {
                hour: "numeric",
                minute: "2-digit",
                timeZone: tenantTimezone,
              })}
            </button>
          );
        })}
      </div>
    </div>
  );
}
