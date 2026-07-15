"use client";

import { useMemo, useState } from "react";

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

const WEEKDAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

function toDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export default function SlotPicker({
  slotsByDay,
  selectedSlot,
  onSelectSlot,
  tenantTimezone,
}: SlotPickerProps) {
  const days = Object.keys(slotsByDay).sort();

  const firstAvailable = days[0];
  const initialMonth = firstAvailable
    ? { year: Number(firstAvailable.slice(0, 4)), month: Number(firstAvailable.slice(5, 7)) - 1 }
    : { year: new Date().getFullYear(), month: new Date().getMonth() };

  const [viewMonth, setViewMonth] = useState(initialMonth);
  const [activeDay, setActiveDay] = useState<string>(firstAvailable ?? "");

  const monthLabel = new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
    timeZone: tenantTimezone,
  });

  const gridCells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.year, viewMonth.month, 1);
    const startWeekday = firstOfMonth.getDay(); // 0=domingo
    const daysInMonth = new Date(viewMonth.year, viewMonth.month + 1, 0).getDate();
    const cells: Array<{ key: string; day: number } | null> = [];
    for (let i = 0; i < startWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ key: toDateKey(viewMonth.year, viewMonth.month, d), day: d });
    }
    return cells;
  }, [viewMonth]);

  const canGoPrev = days.length > 0 && `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}` > days[0].slice(0, 7);
  const lastMonth = days.length > 0 ? days[days.length - 1].slice(0, 7) : null;
  const canGoNext = lastMonth ? `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, "0")}` < lastMonth : false;

  if (days.length === 0) {
    return (
      <div className="card">
        <p className="muted">No hay horarios disponibles por ahora.</p>
      </div>
    );
  }

  return (
    <div className="card space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => setViewMonth((m) => (m.month === 0 ? { year: m.year - 1, month: 11 } : { year: m.year, month: m.month - 1 }))}
            disabled={!canGoPrev}
            aria-label="Mes anterior"
            className="w-8 h-8 rounded-full flex items-center justify-center border-[0.5px] border-sand-300 text-pine-700 disabled:opacity-30 disabled:cursor-not-allowed hover:border-pine-400 transition-colors"
          >
            ‹
          </button>
          <p className="card-title capitalize">{monthLabel}</p>
          <button
            type="button"
            onClick={() => setViewMonth((m) => (m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 }))}
            disabled={!canGoNext}
            aria-label="Mes siguiente"
            className="w-8 h-8 rounded-full flex items-center justify-center border-[0.5px] border-sand-300 text-pine-700 disabled:opacity-30 disabled:cursor-not-allowed hover:border-pine-400 transition-colors"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {WEEKDAY_LABELS.map((label, i) => (
            <p key={i} className="text-center text-xs font-medium text-sand-500">
              {label}
            </p>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {gridCells.map((cell, i) => {
            if (!cell) return <div key={`empty-${i}`} />;
            const hasSlots = Boolean(slotsByDay[cell.key]?.length);
            const isActive = activeDay === cell.key;
            return (
              <button
                key={cell.key}
                type="button"
                disabled={!hasSlots}
                onClick={() => setActiveDay(cell.key)}
                className={`aspect-square rounded-[7px] text-sm tabular-nums transition-colors flex items-center justify-center
                  ${isActive ? "bg-pine-600 text-cream-50" : hasSlots ? "bg-cream-0 text-pine-700 border-[0.5px] border-sand-300 hover:border-pine-400" : "text-sand-300 cursor-not-allowed"}`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      {activeDay && (
        <div>
          <p className="field-label mb-3">
            Horarios para{" "}
            {new Date(activeDay + "T00:00:00").toLocaleDateString("es-MX", {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: tenantTimezone,
            })}
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {(slotsByDay[activeDay] ?? []).map((slot) => {
              const isActive = selectedSlot?.start_at === slot.start_at;
              return (
                <button
                  key={slot.start_at}
                  disabled={!slot.available}
                  onClick={() => slot.available && onSelectSlot(slot)}
                  className={`slot ${isActive ? "slot--active" : ""} ${!slot.available ? "slot--taken" : ""}`}
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
      )}
    </div>
  );
}
