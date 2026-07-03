import { DateTime } from 'luxon';

// Reglas de disponibilidad recurrente (hora LOCAL de la zona del tenant, sin fecha).
export interface AvailabilityRule {
  weekday: number;        // 0=domingo ... 6=sábado
  start_time: string;     // 'HH:MM:SS' local
  end_time: string;       // 'HH:MM:SS' local
  slot_minutes: number;
  buffer_minutes: number;
}
export interface Interval {
  start_at: string;       // ISO (UTC)
  end_at: string;         // ISO (UTC)
}
export interface AvailabilityPayload {
  rules: AvailabilityRule[];
  blocks: Interval[];     // días/horas bloqueadas
  busy: Interval[];       // citas vivas
}
export interface BookingSettings {
  lead_time_hours: number;
  max_horizon_days: number;
}
export interface Slot {
  start: string;          // ISO (UTC)
  end: string;            // ISO (UTC)
}
export interface GenerateSlotsArgs {
  availability: AvailabilityPayload;
  timezone: string;       // IANA, p.ej. 'America/Mexico_City'
  settings: BookingSettings;
  from: string;           // ISO — inicio de la ventana pedida
  to: string;             // ISO — fin de la ventana pedida
  now?: string;           // ISO — inyectable para tests (default: DateTime.utc())
}

/**
 * Genera los slots reservables AL VUELO. No almacena nada.
 * - Reglas en hora local de la zona del tenant (usa Luxon, nunca offset fijo).
 * - buffer_minutes expande los intervalos OCUPADOS en ambos lados al checar traslape.
 * - Respeta lead_time_hours (mínimo de anticipación) y max_horizon_days (horizonte).
 * - Excluye slots que caen en bloques o traslapan citas vivas (con buffer).
 */
export function generateSlots(args: GenerateSlotsArgs): Slot[] {
  const { availability, timezone: zone, settings } = args;

  const now = args.now ? DateTime.fromISO(args.now, { zone: 'utc' }) : DateTime.utc();
  const leadCutoff = now.plus({ hours: settings.lead_time_hours });
  const horizonCutoff = now.plus({ days: settings.max_horizon_days });

  // Ventana efectiva = intersección de lo pedido con [leadCutoff, horizonCutoff].
  const reqFrom = DateTime.fromISO(args.from, { zone: 'utc' });
  const reqTo = DateTime.fromISO(args.to, { zone: 'utc' });
  const windowStart = DateTime.max(reqFrom, leadCutoff);
  const windowEnd = DateTime.min(reqTo, horizonCutoff);
  if (windowEnd <= windowStart) return [];

  // Bloques y ocupados a UTC (los ocupados se expanden por buffer al comparar).
  const blocks = availability.blocks.map((b) => ({
    start: DateTime.fromISO(b.start_at, { zone: 'utc' }),
    end: DateTime.fromISO(b.end_at, { zone: 'utc' }),
  }));
  const busy = availability.busy.map((b) => ({
    start: DateTime.fromISO(b.start_at, { zone: 'utc' }),
    end: DateTime.fromISO(b.end_at, { zone: 'utc' }),
  }));

  const overlaps = (aS: DateTime, aE: DateTime, bS: DateTime, bE: DateTime) =>
    aS < bE && aE > bS;

  const slots: Slot[] = [];

  // Iteramos día por día en la zona del tenant (para respetar DST correctamente).
  let cursorDay = windowStart.setZone(zone).startOf('day');
  const lastDay = windowEnd.setZone(zone).endOf('day');

  while (cursorDay <= lastDay) {
    const weekday = cursorDay.weekday % 7; // Luxon: 1=lunes..7=domingo -> 0=domingo..6=sábado
    const dayRules = availability.rules.filter((r) => r.weekday === weekday);

    for (const rule of dayRules) {
      const [sh, sm] = rule.start_time.split(':').map(Number);
      const [eh, em] = rule.end_time.split(':').map(Number);
      const ruleStart = cursorDay.set({ hour: sh, minute: sm, second: 0, millisecond: 0 });
      const ruleEnd = cursorDay.set({ hour: eh, minute: em, second: 0, millisecond: 0 });

      let slotStartLocal = ruleStart;
      const bufferMin = rule.buffer_minutes ?? 0;

      while (slotStartLocal.plus({ minutes: rule.slot_minutes }) <= ruleEnd) {
        const slotEndLocal = slotStartLocal.plus({ minutes: rule.slot_minutes });
        const startUtc = slotStartLocal.toUTC();
        const endUtc = slotEndLocal.toUTC();

        const withinWindow = startUtc >= windowStart && endUtc <= windowEnd;

        if (withinWindow) {
          const hitsBlock = blocks.some((bl) => overlaps(startUtc, endUtc, bl.start, bl.end));
          // Buffer expande el ocupado en ambos lados.
          const hitsBusy = busy.some((bz) =>
            overlaps(
              startUtc,
              endUtc,
              bz.start.minus({ minutes: bufferMin }),
              bz.end.plus({ minutes: bufferMin }),
            ),
          );
          if (!hitsBlock && !hitsBusy) {
            slots.push({ start: startUtc.toISO()!, end: endUtc.toISO()! });
          }
        }

        slotStartLocal = slotEndLocal;
      }
    }

    cursorDay = cursorDay.plus({ days: 1 }).startOf('day');
  }

  // Orden cronológico y dedup por (start).
  const seen = new Set<string>();
  return slots
    .sort((a, b) => a.start.localeCompare(b.start))
    .filter((s) => (seen.has(s.start) ? false : (seen.add(s.start), true)));
}
