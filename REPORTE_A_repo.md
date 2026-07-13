# REPORTE A · Inventario del repositorio (SOLO LECTURA)

Proyecto: `consulta-plataforma` · foto real tras Sprints 1–3 · reconciliación contra Sprint 0.
Fecha: 2026-07-10. Sin cambios: reporte únicamente.

---

## A.1 · Ledger de migraciones (repo) — 20 archivos `001`→`020`

| # | Archivo | Resumen (1 línea, del encabezado) |
|---|---|---|
| 001 | `001_tenancy.sql` | Tenancy base. |
| 002 | `002_consulta.sql` | Consulta / appointments. |
| 003 | `003_embudo.sql` | Embudo / leads. |
| 004 | `004_cursos.sql` | Cursos. |
| 005 | `005_booking_y_eventos.sql` | Booking + live events. |
| **006** | `006_booking_hardening.sql` | Endurecimiento de booking. |
| **007** | `007_consent.sql` | Tabla `consents` (evidencia LFPDPPP) + RPC `public_record_consent`. |
| **008** | `008_current_user_context.sql` | Contexto de usuario actual (helpers RLS). |
| **009** | `009_public_get_tenant_by_domain.sql` | RPC pública resolver tenant por dominio. |
| **010** | `010_get_tenant_by_domain_add_slug.sql` | Añade slug al resolver de tenant. |
| **011** | `011_manual_confirm.sql` | Confirmación manual (transferencia). |
| **012** | `012_notas_operativas_guard.sql` | Guard notas operativas. |
| **013** | `013_professional_create_appointment.sql` | Alta de cita por la profesional (manual). |
| **014** | `014_recurrence.sql` | Recurrencias. |
| **015** | `015_issue_credit.sql` | Emisión de crédito. |
| **016** | `016_update_appointment.sql` | Actualizar cita (reagendar). |
| **017** | `017_credit_return_on_cancel.sql` | Devolución de crédito al cancelar. |
| **018** | `018_patient_magic_link.sql` | Magic link de paciente. |
| **019** | `019_booking_leadtime_horizon.sql` | Lead-time / horizonte de reserva. |
| **020** | `020_event_pi_unique.sql` | Índice único de payment_intent por evento (idempotencia). |

Seed: `supabase/seed/seed_tenant_profesional.sql`.
**Sprint 0 solo conocía 001–005 (+007).** Todas las de 006→020 son nuevas respecto a la foto congelada.

---

## A.2 · Capa lib / dominio

| Path | Existe | Nota |
|---|---|---|
| `src/lib/booking/slots.ts` | ✓ | Generación de slots (+ `__tests__/slots.test.ts`). |
| `src/lib/booking/validate.ts` | ✓ | Validaciones de booking. |
| `src/lib/booking/confirm.ts` | ✓ | **Fuente única de efectos post-confirmación** (ver firmas). |
| `src/lib/events/confirm-registration.ts` | ✓ | Confirmación idempotente de registro a evento. |
| `src/lib/payments/stripe.ts` | ✓ | Cliente Stripe. |
| `src/lib/payments/config.ts` | ✓ | Config de pagos. |
| `src/lib/payments/checkout.ts` | ✓ | `createCheckoutSession` (Connect vía `stripeAccountId`). |
| `src/lib/email/appointment.ts` · `email/live-event.ts` | ✓ | Plantillas Resend (cita / evento en vivo). |
| `src/lib/tenant/context.ts` · `get-tenant-slug.ts` · `useTenantTimezone.ts` | ✓ | Resolución de tenant + timezone. |
| `src/lib/tenant/resolve-tenant.ts` | ✗ | **NO existe** con ese nombre; el rol lo cumplen `context.ts` / `get-tenant-slug.ts`. |
| `src/lib/auth/link-account.ts` · `panel/status-badge.ts` · `video/daily.ts` · `design-tokens.ts` | ✓ | — |

### Firmas críticas (Z1 — reúso, no duplicar)

**`confirm.ts` → `applyConfirmationEffects`**
```
applyConfirmationEffects(
  supabase: ReturnType<typeof createAdminClient>,
  input: ConfirmationEffectsInput,   // { appointmentId, startAt, endAt, videoRoomUrl,
                                      //   patientEmail, patientFullName, tenantTimezone }
): Promise<string | null>            // devuelve roomUrl final (o null)
```
- **FUENTE ÚNICA** de efectos tras `confirmed`: asegura sala Daily (idempotente, crea solo si falta) + manda correo. NUNCA lanza. El descuento de crédito NO vive aquí (es atómico en `public_create_credit_appointment`).
- **Lo importan/llaman (los 3 caminos de confirmación + panel):**
  `api/webhooks/stripe/route.ts` · `api/booking/create/route.ts` · `api/appointments/[id]/confirm-transfer/route.ts` · `api/panel/citas/route.ts`.

**`confirm-registration.ts` → `confirmEventRegistration`**
```
confirmEventRegistration(
  supabase: Admin,
  args: { registrationId, liveEventId, tenantId, paymentIntentId },
): Promise<string>   // string de estado para el log del webhook
```
- Marca `paid` SOLO si estaba `pending_payment` (idempotente; `23505` → `idempotent_pi`). Asegura sala Daily **compartida por evento**. **NO reusa `applyConfirmationEffects`** (acoplado a appointments) — deliberado.
- **Lo importa/llama SOLO:** `api/webhooks/stripe/route.ts`.

---

## A.3 · Rutas API

| Path | Existe | Qué hace (del código) |
|---|---|---|
| `api/booking/availability/route.ts` | ✓ | Disponibilidad de slots. |
| `api/booking/create/route.ts` | ✓ | Crea cita; registra consentimiento (`public_record_consent`, 2 caminos); camino-crédito llama `applyConfirmationEffects`. |
| `api/checkout/create-session/route.ts` | ✗ | **NO existe.** El checkout vive en la lib `payments/checkout.ts` (`createCheckoutSession`), invocada desde booking y events. |
| `api/webhooks/stripe/route.ts` | ✓ | Ver ramas abajo. |
| `api/daily/create-room/route.ts` | ✗ | **NO existe** como ruta; la creación de sala es la lib `video/daily.ts` (`createDailyRoom`), llamada desde los helpers confirm. |
| `api/leads/capture/route.ts` | ✓ | Captura lead. **No registra consentimiento** (solo lo menciona en comentario). |
| `api/events/register/route.ts` | ✓ | Registro a evento; ver rama precio 0 abajo (Z1/Z2). |
| `api/appointments/[id]/confirm-transfer/route.ts` | ✓ | Confirmación manual de transferencia → `applyConfirmationEffects`. |
| `api/patient/{request-link,link-callback}` · `api/tenant/context` · `api/panel/*` (12) | ✓ | Magic link, contexto tenant, panel profesional. |

### `webhooks/stripe/route.ts` — eventos y ramas
- **`payment_intent.succeeded`** → si `pi.metadata.live_event_id` presente → `confirmEventRegistration(...)`.
- **`checkout.session.completed`** → ignora si `payment_status !== 'paid'`; si `metadata.live_event_id` presente → `confirmEventRegistration(...)`; si no es evento → rama de **cita**: guard idempotente (`appt.status === 'confirmed' && stripe_payment_intent === pi`), update con guard `23505`, luego `applyConfirmationEffects(...)`.
- Eventos en vivo: se marca `paid` en `live_event_registrations` **dentro de** `confirmEventRegistration`, no en el webhook.

### `events/register/route.ts` — tratamiento del precio 0 (Z1/Z2)
```
priceCents = event.price_cents ?? 0
regId = rpc('public_register_live_event', { tenant_id, event_id, email, name })  // control de cupo FOR UPDATE
if (priceCents <= 0) return { status:'registered', registration_id: regId }      // ← rama gratis
// pago: lee stripe_account_id de payment_settings → createCheckoutSession(method:'card') → checkout_url
```
- **Z1:** la rama gratis **NO llama a `confirm-registration`** (ese helper corre solo tras pago). No manda correo (comentario: "iteración futura").
- **Z2:** el registro usa `public_register_live_event` con **email/name únicamente** — **NO setea `auth_user_id`** aunque haya sesión activa. No hay vínculo de sesión.
- Pago: **solo tarjeta** (`method:'card'`), sin rama OXXO en eventos.

---

## A.4 · Crons

| path (`vercel.json`) | schedule | tabla · predicado | CRON_SECRET |
|---|---|---|---|
| `/api/cron/release-holds` | `*/15 * * * *` | `appointments` UPDATE `status='cancelled'` WHERE `created_by='patient'` AND `hold_expires_at` NOT NULL AND `< now` AND `status IN (pending_payment, pending_verification)`. Citas manuales (hold NULL) quedan fuera. | ✓ `Authorization: Bearer <CRON_SECRET>` (500 si falta, 401 si no coincide). |
| `/api/cron/release-event-holds` | `*/15 * * * *` | `live_event_registrations` **DELETE** WHERE `payment_status='pending_payment'` AND `created_at < cutoff`. Nunca toca `paid` ni `free`. | ✓ `Authorization: Bearer <CRON_SECRET>` (500 si falta, 401 si no coincide). |

Ambos registrados en `vercel.json`. No hay `session-reminders`.

---

## A.5 · Legal / consentimiento (núcleo Sprint 4)

- **`ConsentBox.tsx` NO existe** como componente. El consentimiento vive **inline** en `src/components/booking/CheckoutContact.tsx` (`consentCheckbox`: checkbox + link `/privacidad`, botón `disabled` hasta aceptar; duplicado en 2 puntos del mismo archivo).
- **Versión del aviso que se envía al servidor** — origen exacto:
  `src/components/booking/BookingFlow.tsx:95`
  ```
  consent: { accepted: values.accepted_consent, privacy_version: process.env.NEXT_PUBLIC_PRIVACY_VERSION ?? '1.0.0' }
  ```
  Fallback duro `'1.0.0'` repetido también en `privacidad/page.tsx:6`. **No hay fuente única.**
- **Páginas legales:** existe **solo** `src/app/privacidad/page.tsx` — contenido **hardcodeado** (plantilla LFPDPPP, lee versión de env). **No hay `/terminos`** ni aviso separado. No se fetchea de BD.
- **`public_record_consent` se llama desde:** `api/booking/create/route.ts` (helper `recordConsent`, líneas 43/133/171 — 2 caminos: crédito y pago). **Ningún otro callsite** (ni eventos, ni leads).

---

## A.6 · Variables de entorno (SOLO NOMBRES, presentes en `.env.local`)

Supabase: `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY`
Stripe: `STRIPE_SECRET_KEY` · `STRIPE_WEBHOOK_SECRET` · `STRIPE_CONNECT_CLIENT_ID` · `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` · `APPLICATION_FEE_PERCENT`
Daily: `DAILY_API_KEY` · `DAILY_DOMAIN`
Resend: `RESEND_API_KEY` · `RESEND_FROM`
App: `NEXT_PUBLIC_APP_URL` · `NEXT_PUBLIC_BASE_DOMAIN`
Legal/cron: **`NEXT_PUBLIC_PRIVACY_VERSION`** ✓ · **`CRON_SECRET`** ✓
Feature flags: `ENABLE_COURSES` · `ENABLE_EMAIL_SEQUENCES` · `ENABLE_MULTI_TIMEZONE`

---

## A.7 · Confrontación con META_PROMPT_OPUS_Sprint4

- **"Estado verificado" (foto Sprint 0):** desactualizado. Confirmado: migraciones llegan a **020** (no 005/007); `confirm.ts` y `confirm-registration.ts` existen y son helpers vivos; consentimiento y crons ya implementados.
- **Grupo Z:**
  - **Z1 (eventos gratis):** confirmado — rama gratis en `events/register` retorna `registered` sin reusar `confirm-registration` ni mandar correo. Reúso pendiente de decisión.
  - **Z2 (vínculo de sesión):** confirmado — `public_register_live_event` no captura `auth_user_id`; registro anónimo por email aunque haya sesión.
  - **Z3 (drift `booking_settings`):** **no verificable desde el repo** — requiere introspección remota (Prompt B/C).
- **Legal:** contradice cualquier supuesto de `ConsentBox` unificado o página `/terminos`: solo checkbox inline + `/privacidad` hardcodeada.

---

## A.8 · Hallazgos que requieren decisión (SIN resolver)

1. **Versión de aviso sin fuente única** — `'1.0.0'` hardcodeado en 3 sitios (`BookingFlow.tsx:95`, `privacidad/page.tsx:6`, default de CheckoutContact). Candidato a constante server-side (carril Opus S4).
2. **`ConsentBox` inexistente** — consentimiento inline y duplicado en `CheckoutContact.tsx`; el objetivo de fuente única (Sonnet) parte de cero.
3. **Cobertura de consentimiento parcial** — `public_record_consent` solo en `booking/create`. Eventos y leads no registran evidencia. Decidir si aplica LFPDPPP a eventos gratis / captura de leads.
4. **Z1** — rama gratis de eventos no reusa `confirm-registration` ni envía correo. Decidir si unificar efectos.
5. **Z2** — sin `auth_user_id` en registro a eventos. Decidir si vincular sesión activa.
6. **Solo una página legal** — falta decidir si S4 añade `/terminos`.
7. **Z3 (`booking_settings` drift)** — pendiente de Prompt B/C (remoto).
