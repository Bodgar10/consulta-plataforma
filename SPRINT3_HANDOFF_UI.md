# Sprint 3 — Handoff completo para construir la UI (para Sonnet)

> Este documento describe TODO lo que el carril backend (Opus) construyó en el Sprint 3 de
> `consulta-plataforma` (plataforma multi-tenant de psicología). Tu trabajo (Sonnet) es construir
> la UI que consume estos contratos. **El backend NO se toca**: endpoints, RPCs, migraciones y
> helpers ya están aplicados y verificados (typecheck verde, migraciones 017–020 en remoto).

---

## 0. REGLA CERO — investiga y analiza ANTES de escribir prompts o UI

Antes de proponer/escribir cualquier componente, **corre estos pasos de reconocimiento y pega los
resultados** en tu propio hilo. No asumas la forma del código: el repo es la fuente de verdad para
código de app; el remoto es la fuente para el esquema/RPCs.

```bash
# Estructura de app y componentes existentes
find src/app -type d | sort
ls -R src/components
ls -R src/lib

# Design system y estilos (ya existe de Sprints 1/2 — reúsalo, no inventes otro)
find src -iname "*design*" -o -iname "*theme*" -o -iname "*tokens*" | grep -iv node_modules
grep -rn "fontSize\|colors\|spacing\|radius" src/lib src/styles 2>/dev/null | grep -iv node_modules | head -40

# Cómo se formatea fecha/zona hoy (SIEMPRE luxon, NUNCA hardcodear zona)
grep -rn "luxon\|DateTime\|setZone\|FALLBACK_TENANT_TIMEZONE" src | grep -iv node_modules

# Cómo se resuelve el tenant en el cliente hoy (path-based)
grep -rn "getTenantSlug\|x-tenant-slug\|params.tenant\|\\[tenant\\]" src | grep -iv node_modules

# Cliente Supabase del navegador (para llamadas client-side)
cat src/utils/supabase/client.ts

# Páginas ya existentes que vas a extender o imitar
sed -n '1,60p' "src/app/(patient)/mi-cuenta/page.tsx"
sed -n '1,60p' "src/app/(protected)/agenda/page.tsx"
ls "src/app/(auth)"
```

Reglas de estilo del proyecto que DEBES respetar (verifícalas con el grep de arriba):
- **Zona horaria:** formatear SIEMPRE con **luxon**: `DateTime.fromISO(iso, { zone: 'utc' }).setZone(tz).setLocale('es').toFormat(...)`. **Prohibido hardcodear** `America/Mexico_City` ni offsets. La `tz` viene del backend (ver §2 endpoint de contexto).
- **Multi-tenant path-based:** el piloto corre en `consulta-plataforma.vercel.app/{slug}/...`. El cliente conoce su `slug` por la URL; el `tenant_id` (uuid) se obtiene del contexto (ver §2). Todos los `/api/*` nuevos del Sprint 3 esperan **`tenant_id`** (no slug, no host).
- **Idioma:** español (es-MX). Datos de salud ⇒ tono cuidado, sin tecnicismos.
- **Design system:** ya existe en código (Sprints 1/2). Reúsalo. No introduzcas otra librería de UI ni otro sistema de tokens.

---

## 1. Arquitectura y decisiones transversales del Sprint 3

- **Resolución de tenant = por `tenant_id`** (uuid) en el request, igual que `booking/create`. Se
  abandonó el intento previo "por host" (no funciona en dominio único) y el intermedio "por slug".
- **Dinero (Stripe Connect):** destination charge. `transfer_data.destination = payment_settings.stripe_account_id`,
  `application_fee_amount` = `applicationFeeAmount()` (0% en el piloto), `currency = 'mxn'` (minúscula).
- **Magic link del paciente:** Supabase Auth nativo (`signInWithOtp`) server-side + `verifyOtp` con
  `token_hash` en el callback (NO PKCE). Login sin contraseña.
- **Fuente única de contexto de tenant:** `getTenantContextById(tenantId)` → `src/lib/tenant/context.ts`.
- **Fechas:** luxon en todo el proyecto (no date-fns-tz).
- **Correos:** Resend directo (no hay wrapper genérico). HTML inline. Nunca lanzan.
- **Video:** Daily. Sala por cita (`appt-<id>`) o por evento (`event-<id>`).

Migraciones aplicadas en remoto (cero drift confirmado): **017** (devolución de crédito al cancelar),
**018** (magic link: funciones), **019** (validación lead-time/horizonte server-side), **020** (índice
único de PI para registros de evento).

---

## 2. Contratos de API que la UI consume (FIJOS — no cambian)

### 2.1 Contexto del tenant (zona horaria, moneda, nombre) — **base para toda la UI**
```
GET /api/tenant/context?tenant_id=<uuid>
200 → { tenant_id, slug, display_name, timezone, currency }   // timezone = IANA, currency = 'MXN'
400 → { error: 'tenant_id_requerido' }
404 → { error: 'tenant_context_unavailable' }
```
**Uso:** al cargar cualquier vista con sesión (agenda, cobros, mi-cuenta, horarios), pide este contexto
una vez por sesión de tenant, cachéalo, y usa `timezone` para TODO el formateo de fechas.

Helper server-side (por si renderizas en server component; NO lo dupliques en cliente):
```ts
// src/lib/tenant/context.ts  (YA EXISTE)
export type TenantContext = {
  tenant_id: string;
  slug: string | null;
  display_name: string | null;
  timezone: string;   // IANA. Nunca offset, nunca hardcode.
  currency: string;   // 'MXN' para UI (el dinero real usa 'mxn' de PAYMENTS_CONFIG)
};
export async function getTenantContextById(tenantId: string): Promise<TenantContext>;
// Lee tenants por id con service role. LANZA si el tenant no existe o no tiene timezone.
```

> **TAREA UI pendiente explícita (fallback #3):** en `src/app/(protected)/agenda/page.tsx` existe
> `const FALLBACK_TENANT_TIMEZONE = "America/Mexico_City"`. Debes **eliminar esa constante** y
> consumir `GET /api/tenant/context?tenant_id=<id de sesión>` para obtener la zona. Es el último
> fallback hardcodeado que Opus dejó para ti.

### 2.2 Magic link del paciente (login sin contraseña)
```
POST /api/patient/request-link
body: { tenant_id: string, email: string }
→ SIEMPRE 202 { ok: true }
```
**Privacidad:** responde 202 pase lo que pase (no revela si el correo existe). El OTP solo se dispara
si hay paciente para ese `(tenant_id, email)`.

**UI:** en "mi cuenta" (o una pantalla de acceso del paciente) pon un input de email + botón
"Enviarme un enlace de acceso". Tras el POST, muestra SIEMPRE el mismo mensaje neutro:
> "Si tu correo está registrado, te enviamos un enlace para entrar."

Nunca muestres "correo no encontrado".

El enlace del correo lleva al callback (abajo). La UI **no** llama el callback; es el navegador quien
cae ahí al hacer clic en el correo:
```
GET /api/patient/link-callback?token_hash=...&type=signup|magiclink&tenant_id=<uuid>
→ crea sesión (cookie), vincula paciente, y REDIRIGE a /mi-cuenta  (o /mi-cuenta?link=error si falla)
```
**UI:** en `/mi-cuenta`, si la query trae `?link=error`, muestra un aviso "Tu enlace expiró o ya se
usó. Pide uno nuevo." y ofrece de nuevo el formulario de request-link.

> Requiere config de dashboard (la hace el humano, no tú): Redirect URLs + plantillas de correo.

### 2.3 Registro + pago a evento en vivo
```
POST /api/events/register
body: { tenant_id: string, event_id: string, email: string, name: string }
→ gratis: 200 { status: 'registered', registration_id }
→ pago:   200 { status: 'checkout', checkout_url }   // redirige el navegador a checkout_url (Stripe)
→ lleno:  409 { error: 'event_full' }
→ 404 { error: 'event_unavailable' } | 400 { error: 'bad_request' | 'register_failed' } | 409 { error: 'connect_not_ready' }
```
**UI:** página pública del evento (probablemente `/[tenant]/evento/[event_id]` o similar — verifica el
routing existente). Formulario { nombre, email }. Al enviar:
- si `status==='checkout'` → `window.location.href = checkout_url`.
- si `status==='registered'` → pantalla "¡Registrado!".
- si 409 `event_full` → "Cupo lleno".

Tras el pago, Stripe redirige a `successUrl`/`cancelUrl` que el backend fija como
`/evento/<event_id>?pago=ok` y `?pago=cancelado`. **UI:** maneja esos query params para mostrar
confirmación / cancelación. El asiento y el pago los confirma el webhook (backend); el correo con el
enlace de la sala Daily lo manda el backend. La UI de "mis eventos" del paciente puede mostrar el
`video_room_url` cuando el registro esté `paid`.

Datos del evento para pintar la landing del evento: usa la RPC pública (ver §4)
`public_get_live_event(p_tenant_id, p_event_id)` → jsonb `{ id, title, description, start_at, end_at, price_cents, capacity, seats_taken }`.

### 2.4 Captura de lead (embudo / lead magnet)
```
POST /api/leads/capture
body: { tenant_id, landing_slug, email, name?, phone?, utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, referrer? }
→ 200 { ok: true, magnet_url?: string }
→ 400 { error: 'bad_request' | 'capture_failed' }
```
**UI:** formulario embebido en la landing pública (`/[tenant]/l/[landing_slug]` o el routing que exista
— verifícalo). Captura email (+ opcional nombre/teléfono). Los `utm_*` y `referrer` los tomas de la URL
(`document.referrer`, querystring). Tras 200, si viene `magnet_url`, ofrece el recurso (link de descarga
"Descargar ahora"). El backend congela la atribución UTM (primera gana) y resuelve el magnet server-side.

Datos de la landing para pintarla: RPC pública `public_get_landing(p_tenant_id, p_slug)` → jsonb
`{ id, theme, headline, ..., lead_magnet: { id, title, description, file_url } | null }`.

### 2.5 Endpoints existentes de Sprints 1/2 que la UI ya usa (contexto, no los cambies)
- `POST /api/booking/create` — crea la cita (card/oxxo/transfer/credit). Body incluye `tenant_id`,
  `start_at`, `end_at`, `full_name`, `email`, `phone`, `payment_mode`, `consent`. Devuelve
  `{ checkout_url }` (card/oxxo), o `{ status:'confirmed', ... }` (credit), o
  `{ status:'pending_verification', payment_settings }` (transfer).
- `GET /api/booking/availability?tenant_id=&from=&to=` → `{ slots: [{start,end}], timezone }`.
  **NOTA:** ahora, si el tenant no tiene zona, responde `400 { error: 'tenant_timezone_missing' }`
  (antes asumía CDMX). Maneja ese 400 en la UI de agendado.
- Panel profesional (protegido): endpoints bajo `/api/panel/*` (agenda, citas, disponibilidad,
  pacientes, créditos, recurrentes…) — ya existen de Sprint 2. Verifícalos con
  `ls -R src/app/api/panel`.

---

## 3. Cambios de comportamiento del Sprint 3 que impactan la UI

1. **Devolución de crédito al cancelar (Z1):** al cancelar una cita `payment_mode='credit'` con **>24h**
   de antelación, el backend devuelve el crédito y el JSON de respuesta de la cancelación incluye
   `credit_returned: boolean`. **UI del panel:** al cancelar, si `credit_returned===true`, muestra
   "Crédito devuelto al paciente". La función que devuelve esto es `professional_update_appointment`
   (la llama el endpoint de cancelar del panel, ya existente).

2. **Validación de ventana server-side (Z4):** `public_create_appointment` ahora rechaza reservas en el
   pasado / con < lead_time_hours / fuera de max_horizon_days. La UI ya no debe permitir elegir esos
   slots (la validación de app `validateBookingWindow` sigue siendo la primera capa), pero si por carrera
   el backend rechaza, el endpoint devolverá el error de la función — muéstralo con gracia.

3. **`recurrence_group_id`** ya está en el tipo `PanelAppointment` (agenda) y en la BD. Las citas
   recurrentes comparten ese uuid; "cancelar todas las futuras" ya tiene endpoint
   (`/api/panel/citas/recurrentes/[group_id]/cancelar-futuras`). La UI de agenda ya lo usa (ver
   `AgendaView.tsx`); solo asegúrate de mantenerlo.

4. **Jubilación de fallbacks de zona:** el backend ya no asume CDMX en `booking/availability` ni en el
   correo. Tú debes retirar el fallback #3 en `agenda/page.tsx` (ver §2.1).

---

## 4. RPCs públicas disponibles (para render de páginas públicas)

Llámalas desde server components o route handlers con el cliente Supabase (anon o admin según el caso).
Firmas verificadas contra el remoto:

- `public_get_tenant_by_slug(p_slug text)` → `{ id, display_name, branding, timezone, payment_settings }[]`
- `public_get_availability(p_tenant_id, p_from, p_to)` → jsonb `{ rules, blocks, busy }`
- `public_get_live_event(p_tenant_id, p_event_id)` → jsonb `{ id, title, description, start_at, end_at, price_cents, capacity, seats_taken }` (o null)
- `public_get_landing(p_tenant_id, p_slug)` → jsonb `{ id, theme, headline, ..., lead_magnet: {id,title,description,file_url}|null }` (o null)
- `public_create_appointment(...)`, `public_create_credit_appointment(...)`, `public_register_live_event(...)`, `public_capture_lead(...)` — las consume el backend, NO las llames directo desde la UI (usa los endpoints REST de §2).

---

## 5. Esquema (tablas y columnas que la UI necesita conocer)

- **tenants**: `id, slug, custom_domain, display_name, branding jsonb, timezone (IANA, NOT NULL),
  payment_settings jsonb, status, booking_settings jsonb {lead_time_hours, max_horizon_days}`.
- **patients**: `id, tenant_id, full_name, email, phone, auth_user_id (nullable — se llena al vincular
  magic link), unique(tenant_id,email)`.
- **appointments**: `id, tenant_id, patient_id, start_at, end_at, status
  (pending_payment|pending_verification|confirmed|completed|cancelled|no_show), payment_mode
  (single|card|oxxo|transfer|credit|external), credit_id, video_room_url, created_by
  (patient|professional), hold_expires_at, recurrence_group_id, stripe_payment_intent,
  amount_paid_cents`.
- **patient_credits**: `id, tenant_id, patient_id, sessions_total, sessions_used, expires_at`.
- **live_events**: `id, tenant_id, title, description, start_at, end_at, price_cents (null|0 = gratis),
  capacity, published, status (scheduled|live|done|cancelled), video_room_url (sala compartida)`.
- **live_event_registrations**: `id, tenant_id, live_event_id, email, name, auth_user_id,
  payment_status (free|pending_payment|paid), stripe_payment_intent, created_at,
  unique(live_event_id, email)`.
- **leads / landing_pages / lead_magnets**: embudo. `lead_magnets.file_url` = URL pública del recurso
  (Variante A elegida: se sirve directo).

---

## 6. Pantallas de UI a construir (derivadas de lo anterior)

Prioriza según el negocio; cada una consume contratos ya listos:

1. **Acceso del paciente (magic link):** formulario de email → `POST /api/patient/request-link` →
   mensaje neutro. Manejo de `?link=error` en `/mi-cuenta`.
2. **Portal del paciente `/mi-cuenta`:** sus citas (saldo de créditos, próximas, `video_room_url`
   cuando confirmadas), sus registros a eventos, botón de "pedir enlace de acceso".
3. **Landing pública de evento:** datos vía `public_get_live_event`, formulario de registro →
   `POST /api/events/register` → redirección a `checkout_url` o pantalla de registrado. Manejo de
   `?pago=ok|cancelado`.
4. **Landing de embudo / lead magnet:** datos vía `public_get_landing`, formulario →
   `POST /api/leads/capture` → entrega de `magnet_url`. UTMs desde la URL.
5. **Panel profesional (extender lo de Sprint 2):** mostrar `credit_returned` al cancelar; mantener
   recurrencias; retirar el fallback de zona (§2.1) y usar el contexto.
6. **Formateo de fechas global:** un pequeño hook/util cliente `useTenantTimezone()` que lea el
   contexto (cachéalo por sesión) y exponga un `formatFecha(iso)` con luxon. Reemplaza cualquier
   uso de zona hardcodeada.

---

## 7. Cómo debes trabajar (instrucciones para ti, Sonnet)

- **Investiga primero (REGLA CERO).** Corre los greps/reads de §0 y confirma: dónde vive el design
  system, cómo se formatea fecha hoy, qué páginas/[tenant] existen, cómo se obtiene el `tenant_id` en
  cliente, y el cliente Supabase del navegador. **No inventes rutas ni componentes; imítalos.**
- **No toques el backend.** Endpoints, RPCs, migraciones y helpers de `src/lib/{payments,events,email,
  tenant,video,booking}` son de Opus y están cerrados. Si crees que falta un endpoint, PARA y repórtalo
  (no lo improvises).
- **Contratos son fijos.** Consume exactamente los shapes de §2. Si un shape no te cuadra, verifica el
  archivo real del route handler antes de asumir.
- **Zona horaria:** siempre por contexto + luxon. Cero hardcode de CDMX.
- **Privacidad:** en magic link y captura de lead, nunca reveles existencia de cuenta/correo.
- **Verifica cada cambio:** `npx tsc --noEmit` verde antes de dar por hecho un componente. El proyecto
  mantiene "next build verde".
- **Antes de escribir un prompt de UI grande, analiza el código existente y pega tu hallazgo**, igual
  que se hizo en backend: primero reconocer, luego proponer, luego construir.

---

## 8. Pendientes de ops (los hace el humano, no son UI — pero afectan las pruebas E2E)

1. Dashboard Supabase (magic link): Site URL, Redirect URLs `.../api/patient/link-callback**`,
   plantillas "Confirm signup" y "Magic Link" con `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup|magiclink`.
2. Vercel env: `NEXT_PUBLIC_APP_URL=https://consulta-plataforma.vercel.app`, más
   `RESEND_API_KEY`, `RESEND_FROM`, `DAILY_API_KEY`, `DAILY_DOMAIN`, `STRIPE_*`, `CRON_SECRET`,
   `LEAD_MAGNETS_BUCKET` (si algún día se usa bucket privado; hoy Variante A = URL pública directa).
3. Subir el lead magnet y guardar su URL pública en `lead_magnets.file_url`.

Fin del handoff.
