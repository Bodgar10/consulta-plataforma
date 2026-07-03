import { describe, it, expect } from 'vitest';
import { generateSlots, type GenerateSlotsArgs } from '../slots';

const TZ = 'America/Mexico_City';

// Base: sábado 2026-08-01, regla 10:00–12:00 local, slots de 50m + buffer 10m.
function baseArgs(overrides: Partial<GenerateSlotsArgs> = {}): GenerateSlotsArgs {
  return {
    timezone: TZ,
    settings: { lead_time_hours: 12, max_horizon_days: 60 },
    now: '2026-07-20T00:00:00Z', // muy antes de la ventana -> lead-time no estorba
    from: '2026-08-01T00:00:00Z',
    to: '2026-08-02T00:00:00Z',
    availability: {
      // weekday 6 = sábado
      rules: [{ weekday: 6, start_time: '10:00:00', end_time: '12:00:00', slot_minutes: 50, buffer_minutes: 10 }],
      blocks: [],
      busy: [],
      ...(overrides.availability ?? {}),
    },
    ...overrides,
  };
}

describe('generateSlots', () => {
  it('genera slots de 50m dentro de la regla (10:00 y 11:00 local)', () => {
    const slots = generateSlots(baseArgs());
    // 10:00–10:50 y 11:00–11:50 (11:40 no cabe entero antes de 12:00 tras el de 11:00)
    expect(slots.length).toBe(2);
    // 10:00 CDMX (UTC-6 en verano, sin DST en MX desde 2022) = 16:00Z
    expect(slots[0].start).toContain('T16:00');
  });

  it('excluye por traslape con cita viva (buffer expande el ocupado)', () => {
    const args = baseArgs();
    // Ocupa 11:00–11:50 local (17:00–17:50Z). Con buffer 10m, tumba también vecinos adyacentes.
    args.availability.busy = [{ start_at: '2026-08-01T17:00:00Z', end_at: '2026-08-01T17:50:00Z' }];
    const slots = generateSlots(args);
    expect(slots.some((s) => s.start.includes('T17:00'))).toBe(false);
    expect(slots.length).toBe(1); // solo queda el de las 10:00
  });

  it('respeta lead_time_hours (no ofrece slots antes del corte de anticipación)', () => {
    const args = baseArgs({ now: '2026-08-01T15:30:00Z' }); // faltan <12h para el de 16:00Z
    const slots = generateSlots(args);
    expect(slots.some((s) => s.start.includes('T16:00'))).toBe(false);
  });

  it('respeta max_horizon_days (no ofrece slots fuera del horizonte)', () => {
    const args = baseArgs({
      now: '2026-05-01T00:00:00Z',
      settings: { lead_time_hours: 12, max_horizon_days: 30 }, // horizonte hasta 2026-05-31
    });
    const slots = generateSlots(args);
    expect(slots.length).toBe(0);
  });

  it('excluye un día bloqueado', () => {
    const args = baseArgs();
    args.availability.blocks = [{ start_at: '2026-08-01T00:00:00Z', end_at: '2026-08-02T00:00:00Z' }];
    const slots = generateSlots(args);
    expect(slots.length).toBe(0);
  });

  it('no colapsa por DST latente: MX no cambia hora, offset estable -06:00', () => {
    // Verifica que el cálculo local->UTC use la zona IANA y no un offset hardcodeado.
    const slots = generateSlots(baseArgs());
    expect(slots[0].start.endsWith('Z') || slots[0].start.includes('+00:00')).toBe(true);
    // 10:00 local -> 16:00Z consistente
    expect(slots[0].start).toContain('T16:00');
  });
});
