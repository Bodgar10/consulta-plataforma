-- ============================================================
-- 020_event_pi_unique.sql
-- Dedupe: un payment_intent no puede confirmar dos registros de evento (paridad con appointments).
-- ============================================================
create unique index if not exists uniq_event_reg_pi
  on public.live_event_registrations (stripe_payment_intent)
  where stripe_payment_intent is not null;
