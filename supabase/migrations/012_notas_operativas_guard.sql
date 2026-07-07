-- ============================================================
-- 012_notas_operativas_guard.sql
-- Sprint 2 · Guarda "no clínico" de patients.notas_operativas (carril Opus).
-- notas_operativas es NIVEL 2 (operativo), NUNCA nota clínica. Es escudo legal
-- (LFPDPPP: la plataforma no aloja contenido clínico) + argumento de venta.
-- Este CHECK es la última línea de defensa a nivel motor; el aviso "esto no es
-- para notas clínicas" es empuje de UI (carril Sonnet).
-- Tope 2000 chars (~300-350 palabras): suficiente para operativa (preferencias
-- de horario, notas de cobro), corto para desalentar una historia clínica.
-- Pre-check corrido: 0 filas exceden el tope.
-- ============================================================

alter table public.patients
  add constraint notas_operativas_max_len
  check (notas_operativas is null or char_length(notas_operativas) <= 2000);
