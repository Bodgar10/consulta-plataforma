-- ============================================================
-- 021_booking_settings_formaliza.sql
-- Formaliza en el repo la columna tenants.booking_settings, que ya existe
-- en el remoto (aplicada a mano). Idempotente: no altera datos existentes.
-- Frena el drift repo<->remoto (regla §2: el remoto es autoritativo, pero
-- el repo debe reflejarlo con una migración versionada).
-- ============================================================

alter table public.tenants
  add column if not exists booking_settings jsonb not null default
    '{"lead_time_hours": 12, "max_horizon_days": 60}'::jsonb;

-- Nota: NO se hace UPDATE de filas existentes. El default ya coincide con el
-- contenido vivo del tenant real; tocar datos sería innecesario y riesgoso.
