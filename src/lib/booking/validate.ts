import { DateTime } from 'luxon';
import type { BookingSettings } from './slots';

export interface WindowCheck {
  ok: boolean;
  reason?: 'past' | 'lead_time' | 'horizon' | 'invalid_range';
  message?: string;
}

/**
 * Valida que [startAt, endAt) sea reservable según lead-time y horizonte.
 * Server-side, single source of truth. now inyectable para tests.
 */
export function validateBookingWindow(
  startAtISO: string,
  endAtISO: string,
  settings: BookingSettings,
  nowISO?: string,
): WindowCheck {
  const now = nowISO ? DateTime.fromISO(nowISO, { zone: 'utc' }) : DateTime.utc();
  const start = DateTime.fromISO(startAtISO, { zone: 'utc' });
  const end = DateTime.fromISO(endAtISO, { zone: 'utc' });

  if (!start.isValid || !end.isValid || end <= start) {
    return { ok: false, reason: 'invalid_range', message: 'Rango de horario inválido.' };
  }
  if (start <= now) {
    return { ok: false, reason: 'past', message: 'Ese horario ya pasó.' };
  }
  const leadCutoff = now.plus({ hours: settings.lead_time_hours });
  if (start < leadCutoff) {
    return {
      ok: false,
      reason: 'lead_time',
      message: `Se requiere agendar con al menos ${settings.lead_time_hours} horas de anticipación.`,
    };
  }
  const horizonCutoff = now.plus({ days: settings.max_horizon_days });
  if (start > horizonCutoff) {
    return {
      ok: false,
      reason: 'horizon',
      message: `Solo se puede agendar hasta ${settings.max_horizon_days} días en adelante.`,
    };
  }
  return { ok: true };
}
