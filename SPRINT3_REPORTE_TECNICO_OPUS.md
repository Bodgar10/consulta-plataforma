# Sprint 3 — Reporte técnico completo (Opus backend + Sonnet UI)

Proyecto: `consulta-plataforma` (Next.js 14.2.35, App Router, Supabase, Stripe Connect, Daily, Resend, luxon).
Estado: **completo en código, `npx tsc --noEmit` verde en cada paso.** Migraciones 017–020 aplicadas en remoto y verificadas (dump `pg_get_functiondef` diffeado, cero drift). Pendiente solo ops/dashboard (§9) para prueba E2E.

Convención de carriles: **Opus** = dinero/RLS/estructura/auth server-side. **Sonnet** = UI. Los fixes de backend ejecutados fuera de secuencia (B0, C0, C4, D0B) se hicieron **por instrucción explícita del orquestador**, no unilateralmente.

---

## 1. Decisiones transversales

1. **Resolución de tenant = `tenant_id` (uuid) en el request** (patrón `booking/create`). Se descartó "por host" (no sirve en dominio único `consulta-plataforma.vercel.app`) y el intermedio "por slug". Se abandonó el `getTenantContext(slug)` intermedio: `context.ts` quedó solo con `getTenantContextById`.
2. **Dinero (Stripe Connect):** destination charge. `transfer_data.destination = payment_settings.stripe_account_id`, `application_fee_amount = applicationFeeAmount()` (0% en piloto), `currency='mxn'` (minúscula, `PAYMENTS_CONFIG.currency`).
3. **Magic link paciente:** Supabase Auth nativo (`signInWithOtp` server-side) + **`token_hash` + `verifyOtp`** en el callback (NO PKCE/`exchangeCodeForSession` — ver §7.3).
4. **Zona horaria:** luxon en todo (`DateTime.fromISO(iso,{zone:'utc'}).setZone(tz).setLocale('es')`). Cero fallbacks CDMX hardcodeados tras el sprint. `tenants.timezone` es `NOT NULL`.
5. **Correos:** Resend directo (sin wrapper), HTML inline, nunca lanzan.
6. **Fechas de estructura:** los `RETURNS jsonb` públicos (`public_get_landing`, `public_get_live_event`) son **escalares** → `.rpc(...)` sin `.maybeSingle()`. `public_get_tenant_by_slug`/`_by_domain` son `RETURNS TABLE` → **con** `.maybeSingle()`.

---

## 2. Migraciones (todas aplicadas + verificadas cero-drift)

### 017_credit_return_on_cancel.sql
`create or replace function professional_update_appointment(p_appointment_id uuid, p_action text, p_start_at timestamptz default null, p_end_at timestamptz default null) returns jsonb language plpgsql security definer set search_path=''`.
- Delta vs 016 (verbatim el resto, incl. branch `reschedule`): en branch `cancel`, tras `update ... set status='cancelled'`, si `v_payment_mode='credit' and v_credit_id is not null and (v_start_at - now()) > interval '24 hours'` → `update patient_credits set sessions_used = sessions_used - 1 where id = v_credit_id and sessions_used > 0; if found then v_refunded := true`. Retorna `jsonb_build_object('id',..., 'status','cancelled', 'credit_returned', v_refunded)`.
- Regla por **tiempo** (>24h), zona-agnóstica (resta de `timestamptz`). Idempotente: `FOR UPDATE` + transición de estado (re-cancelar cae en el raise de estado inválido). Guard `sessions_used > 0` (nunca negativo).
- **Inverso exacto** del alta con crédito: `public_create_credit_appointment` (006) bloquea fila FIFO, estampa `appointments.credit_id` e incrementa `sessions_used += 1`.
- Verificación: dump remoto diffeado contra 016 = idéntico salvo el bloque → cero drift. Post-check `ilike '%patient_credits%'` y `'%credit_returned%'` = true/true.

### 018_patient_magic_link.sql
- `patient_exists_for_login(p_tenant_id uuid, p_email text) returns boolean language sql stable security definer set search_path=''` → `select exists(select 1 from patients where tenant_id=p_tenant_id and email=lower(p_email))`. Grants: `revoke all ... from public, anon, authenticated; grant execute ... to service_role`. (Privacidad: solo backend sondea existencia.)
- `link_patient_to_auth_user(p_tenant_id uuid, p_email text) returns uuid language plpgsql security definer set search_path=''` → `v_uid := auth.uid()` (raise si null), `update patients set auth_user_id=v_uid where tenant_id=p_tenant_id and email=lower(p_email) and (auth_user_id is null or auth_user_id=v_uid) returning id`. **Anti-secuestro** (no repisa auth_user_id ajeno). Grants: `revoke all ... from public, anon; grant execute ... to authenticated`.
- **`src/types/database.ts` aumentado a mano** (el codegen no incluye estas funciones): ambas agregadas en orden alfabético al bloque `Functions` con `Returns: boolean` / `Returns: string`.
- Verificación post-aplicación: `patient_exists_for_login` ejecutable por `service_role, postgres`; `link_patient_to_auth_user` por `authenticated, service_role, postgres`. anon excluido de ambas. ✔

### 019_booking_leadtime_horizon.sql
`create or replace public_create_appointment(p_tenant_id uuid, p_start_at timestamptz, p_end_at timestamptz, p_full_name text, p_email text, p_phone text, p_payment_mode text) returns uuid ...`.
- Delta vs 002 (verbatim el resto): bloque de guarda **antes** del guard de traslape. `select booking_settings into v_settings from tenants where id=p_tenant_id and status='active'` (raise 'Tenant no disponible' si null); `v_lead_hours := coalesce((v_settings->>'lead_time_hours')::int,12)`; `v_horizon_days := coalesce((v_settings->>'max_horizon_days')::int,60)`; checks: `p_start_at <= now()` (no pasado), `< now()+make_interval(hours=>v_lead_hours)`, `> now()+make_interval(days=>v_horizon_days)`. Re-grant `to anon, authenticated`.
- Cierra **QA-D05**: la RPC está grantada a `anon` → un POST directo saltaba la validación de app `validateBookingWindow` (que sigue como primera capa). Comparaciones de instante (`make_interval`) = zona-agnósticas.
- Verificación: dump remoto = idéntico a 002 sin guarda → cero drift. Post-check `ilike '%booking_settings%'`/`'%make_interval%'` = true/true.

### 020_event_pi_unique.sql
`create unique index if not exists uniq_event_reg_pi on live_event_registrations (stripe_payment_intent) where stripe_payment_intent is not null`. Índice único **parcial** (paridad con el índice de PI de appointments). Verificado en `pg_indexes`.

---

## 3. Backend — helpers y endpoints (carril Opus)

### 3.1 TenantContext (Z2 v2)
- `src/lib/tenant/context.ts`:
  ```ts
  export type TenantContext = { tenant_id: string; slug: string|null; display_name: string|null; timezone: string; currency: string };
  export async function getTenantContextById(tenantId: string): Promise<TenantContext>
  ```
  createAdminClient → `from('tenants').select('id, slug, display_name, timezone').eq('id', tenantId).eq('status','active').single()`; **lanza** si error o `!timezone` (bug de config, no adivina). `currency:'MXN'` constante (no hay columna `currency`; el dinero real usa `'mxn'`). Se **omitió** `import 'server-only'` (no instalado, rompía build).
- `GET /api/tenant/context?tenant_id=<uuid>` → `200 {tenant_id,slug,display_name,timezone,currency}` | `400 {error:'tenant_id_requerido'}` | `404 {error:'tenant_context_unavailable'}`.
- **Fallbacks CDMX jubilados:** `src/app/api/booking/availability/route.ts` (usa `tenant.timezone` directo, `400 {error:'tenant_timezone_missing'}` si null); `src/lib/email/appointment.ts` (formatea fecha solo si `args.timezone`, si no omite la línea + `console.error`).

### 3.2 Magic link — request (A2 v2)
`POST /api/patient/request-link` body `{ tenant_id, email }` → **siempre `202 {ok:true}`** (privacidad total: parseo falla, email inválido, rate-limited, o no existe paciente → mismo 202).
- Rate-limit best-effort en memoria: `Map<`${ip}:${tenantId}:${email}`>`, 5/60s.
- `createAdminClient()` (service_role) para `rpc('patient_exists_for_login', {p_tenant_id, p_email})`.
- Si `exists===true`: cookie client `supabase.auth.signInWithOtp({ email, options:{ shouldCreateUser:true, emailRedirectTo: `${NEXT_PUBLIC_APP_URL ?? ''}/api/patient/link-callback?tenant_id=${tenantId}` }})`.
- **Dep de env:** `NEXT_PUBLIC_APP_URL` requerido (si vacío, `emailRedirectTo` queda relativo → magic link roto).

### 3.3 Magic link — callback (A3 v2 + C0 + C4)
`GET /api/patient/link-callback?token_hash&type&tenant_id`. `ALLOWED_TYPES=['email','signup','magiclink']` (fallback 'email'). Cliente SSR (cookie) — `verifyOtp({type, token_hash})` setea cookie de sesión.
- **Éxito:** `getUser()` → si `tenantId && user.email`:
  - `rpc('link_patient_to_auth_user', {p_tenant_id, p_email:user.email})`.
  - **(C4)** vínculo retroactivo de registros de evento: `createAdminClient().from('live_event_registrations').update({auth_user_id:user.id}).eq('tenant_id',tenantId).eq('email', user.email.toLowerCase()).is('auth_user_id', null)` en `try/catch` (no crítico). **`.eq`+toLowerCase, NO `.ilike`** (el `_` en emails, p.ej. `bodgar_jair@`, es comodín de `ilike` → match de más; los registros se guardan con `lower()`).
  - redirect `/mi-cuenta`.
- **(C0) Error** (sin token_hash o `verifyOtp` falla): `errorRedirect(tenantId)` → `createAdminClient().from('tenants').select('slug').eq('id',tenantId).maybeSingle()` → redirect `/{slug}/entrar?link=error`; fallback `/login` si no resuelve. **Motivo:** el destino previo `/mi-cuenta?link=error` es ruta protegida (`middleware.isProtected = path.startsWith("/mi-cuenta") || /\/panel(\/|$)/`) y un link fallido no crea sesión → el middleware rebotaba a `/login` perdiendo el query.
- `/auth/callback` (registro profesional, PKCE client-side `exchangeCodeForSession`) **NO se toca** — flujo distinto.

### 3.4 Checkout helper (B0 — prerequisito de dinero)
`src/lib/payments/checkout.ts`:
```ts
export type CheckoutMethod = 'card' | 'oxxo';
export type CheckoutArgs = { stripeAccountId, amountCents, productName, customerEmail, method: CheckoutMethod, successUrl, cancelUrl, metadata: Record<string,string> };
export async function createCheckoutSession(args): Promise<{ id: string; url: string|null }>
```
- Movido **verbatim** del inline de `booking/create` (Connect destination charge, `application_fee_amount = applicationFeeAmount(amountCents)`, `transfer_data.destination`, `payment_method_types` de `PAYMENTS_CONFIG.methods`, `currency = PAYMENTS_CONFIG.currency`, oxxo `expires_after_days = PAYMENTS_CONFIG.oxxoExpiresAfterDays`). Usa **`getStripe()`** (no un singleton `stripe`). Omitido `import 'server-only'`.
- `booking/create/route.ts` refactorizado para consumirlo (cero diff de comportamiento; imports muertos `getStripe`/`PAYMENTS_CONFIG`/`applicationFeeAmount` removidos).

### 3.5 Registro a evento (B1)
`POST /api/events/register` body `{ tenant_id, event_id, email, name }` →
`200 {status:'registered', registration_id}` (gratis) | `200 {status:'checkout', checkout_url}` (pago) | `409 {error:'event_full'}` | `404 {error:'event_unavailable'}` | `400 {error:'bad_request'|'register_failed'}` | `409 {error:'connect_not_ready'}`.
- createAdminClient. `rpc('public_get_live_event')` (jsonb; `price_cents` casteado a number), `rpc('public_register_live_event')` (raise 'lleno' → 409). **Solo tarjeta** (`method:'card'` — OXXO tarda 3d → asiento fantasma). `stripe_account_id` de `payment_settings`.
- **Metadata SIN `type`:** `{live_event_id, registration_id, tenant_id}`. El webhook discrimina por presencia de `registration_id` (paralelo a como discrimina citas por `appointment_id`).
- successUrl/cancelUrl = `${base}/evento/${eventId}?pago=ok|cancelado` (ruta raíz, fuera de `[tenant]`).
- **Fuga de asiento conocida:** registra (toma asiento `pending_payment`) antes del check de Connect; si tenant sin `stripe_account_id` → registro fantasma → lo limpia B4.

### 3.6 Webhook eventos (B2)
- `src/lib/events/confirm-registration.ts` `confirmEventRegistration(supabase: Admin, {registrationId, liveEventId, tenantId, paymentIntentId}): Promise<string>`:
  1. `update live_event_registrations set payment_status='paid', stripe_payment_intent=PI where id and payment_status='pending_payment' select id maybeSingle`. Idempotencia: error `23505` → `'idempotent_pi'`; sin fila → `'idempotent_state'`.
  2. Sala Daily **compartida por evento**: `select video_room_url, start_at, end_at from live_events`; si `!video_room_url` → `createDailyRoom({name:`event-${liveEventId}`, startAt, endAt})` + `update ... is('video_room_url', null)` (guard anti-carrera).
  3. `sendLiveEventConfirmation({registrationId})` (una vez, solo transición real). Retorna `'confirmed'`.
- `src/app/api/webhooks/stripe/route.ts`: rama de evento insertada en **ambas** ramas (`payment_intent.succeeded` y `checkout.session.completed`), keyed en `metadata.{registration_id, live_event_id, tenant_id}`, **antes** del guard `sin_metadata` de citas, con su propio `createAdminClient()`, early return `{received:true, event_registration:status}`. Lógica de citas intacta.
- **`createDailyRoom` GENERALIZADO** (`src/lib/video/daily.ts`): `CreateRoomArgs {appointmentId}` → `{name, startAt, endAt}`; nombre de sala `args.name` (antes `appt-${appointmentId}`). Único caller previo `confirm.ts` actualizado a `name:`appt-${appointmentId}`` (booking sin cambio de comportamiento). Eventos usan `name:`event-${id}``.

### 3.7 Correo evento (B3)
`src/lib/email/live-event.ts` `sendLiveEventConfirmation({registrationId})`: Resend directo, lee `live_event_registrations` + `live_events` + `tenants`, fecha luxon condicional a `tenant.timezone`, HTML inline, nunca lanza. **Único caller = `confirm-registration.ts` (camino pagado)** → **los eventos GRATIS no reciben correo ni sala** (deuda §8).

### 3.8 Cron limpieza asientos (B4)
`src/app/api/cron/release-event-holds/route.ts`: GET, `runtime='nodejs'`, auth `Authorization: Bearer <CRON_SECRET>` (500 sin secret, 401 header distinto), createAdminClient, `DELETE live_event_registrations where payment_status='pending_payment' and stripe_payment_intent is null and created_at < now()-30min`. `vercel.json` crons: `{path:'/api/cron/release-event-holds', schedule:'*/15 * * * *'}` (junto a `release-holds` existente).

### 3.9 Captura de lead (C1 backend)
`POST /api/leads/capture` body `{ tenant_id, landing_slug, email, name?, phone?, utm_source?, utm_medium?, utm_campaign?, utm_content?, utm_term?, referrer? }` → `200 {ok:true, magnet_url?}` | `400 {error:'bad_request'|'capture_failed'}`.
- createAdminClient. `rpc('public_get_landing', {p_tenant_id, p_slug})` (jsonb `{id, ..., lead_magnet:{id,title,description,file_url}|null}`) → resuelve `landing_page_id` + `lead_magnet.file_url` server-side. `rpc('public_capture_lead', {...12 args exactos...})` — args: `p_tenant_id, p_email, p_name, p_phone, p_landing_page_id, p_lead_magnet_id, p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_referrer`. **Casts `as string`** en los nullables (los tipos generados marcan cada arg `string`; el cast preserva el null en runtime, patrón `public_record_consent`). `magnet_url` = `lead_magnet.file_url` (Variante A: URL pública directa).

### 3.10 Zona en panel agenda (D0B)
`GET /api/panel/agenda?from&to` ahora responde `{ appointments:[...], timezone }`. Tras la query de appointments (RLS): `from('tenants').select('timezone').limit(1).maybeSingle()` (RLS aísla al tenant del profesional), `400 {error:'tenant_timezone_missing'}` si null. Filtros/RLS/columnas de appointments intactos.

---

## 4. UI (carril Sonnet) — todos verdes

### Embudo
- `src/components/funnel/UTMPersistence.tsx` (A3): `UTMPersistence` (captura UTM primer-toque en `localStorage['first_touch_utm']`, no pisa, lee `window.location.search` directo sin `useSearchParams`/Suspense, falla en silencio) + `readFirstTouchUTM(): FirstTouchUTM|null`. `src/app/[tenant]/layout.tsx` lo monta para todo `/{slug}/*`.
- `src/components/funnel/LeadCaptureForm.tsx` (A2): props `{tenantId, landingSlug, leadMagnetPreview}`, POST `/api/leads/capture` con UTM de `readFirstTouchUTM()`, éxito muestra `magnet_url` si viene.
- `src/app/[tenant]/l/[slug]/page.tsx` (A1): server component, `public_get_tenant_by_slug` (`.maybeSingle()`) + `public_get_landing` (sin maybeSingle), `notFound()` si null, render de bloques (`LandingBlockView` inline) + `LeadCaptureForm` (cta lead_magnet) o link a agendar. Clases `.landing-hero`/`.landing-block`.

### Eventos
- `src/components/events/EventRegisterConfirmation.tsx` (B3): default export, sin props, copy honesto (NO promete correo — gratis no lo manda).
- `src/components/events/EventRegister.tsx` (B2): props `{tenantId, eventId, priceCents, isFull}`, precarga sesión con `useEffect`+`getUser()`, POST `/api/events/register`, `checkout`→`window.location.href`, `registered`→`<EventRegisterConfirmation/>`, mapeo inline de los 4 códigos de error (sin toast, patrón BookingFlow).
- `src/app/[tenant]/evento/[eventId]/page.tsx` (B1): server component, `public_get_tenant_by_slug`+`public_get_live_event`, fecha luxon+`tenant.timezone`, precio `Intl.NumberFormat('es-MX', MXN)`, barra de cupo, `<EventRegister>`.
- `src/app/evento/[eventId]/page.tsx` (B0): pantalla delgada de resultado post-Stripe, **fuera de `[tenant]`** (ruta literal gana sobre `[tenant]` dinámico; middleware la deja pasar sin lista, como `auth`/`privacidad`), solo lee `?pago=ok|cancelado`, sin fetch ni tenant_id.

### Acceso / portal
- `src/components/funnel/RequestLinkForm.tsx` (C1): props `{tenantId}`, POST `/api/patient/request-link`, copy neutro "Si tu correo está registrado…" (nunca afirma envío).
- `src/app/[tenant]/entrar/page.tsx` (C1): server component, `public_get_tenant_by_slug`, muestra aviso si `searchParams.link==='error'` (clases `bg-danger-50`/`field-error`), `<RequestLinkForm>`.
- `src/app/(patient)/mi-cuenta/page.tsx` (C2, reescrito): client component, `Promise.all([appointments, live_event_registrations])` (ambas RLS-scoped, event regs desbloqueados por C4), secciones Próximas/Historial/Eventos, `formatFecha` con `useTenantTimezone(appointments[0].tenant_id)`, mini-mapa `EVENT_BADGE` para `payment_status`. Solo lectura.
- `src/lib/tenant/useTenantTimezone.ts` (D0): hook `useTenantTimezone(tenantId:string|null): State` (idle/loading/ready/error), fetch a `/api/tenant/context?tenant_id=`, no cachea (cross-tenant). Solo lo usa `/mi-cuenta` (`/agenda` usa D0B).
- `src/app/(protected)/agenda/page.tsx` (D0B): retirado `FALLBACK_TENANT_TIMEZONE` (0 en repo), `timezone` del fetch de `/api/panel/agenda`, `weekStart` init local + reencuadre 1-vez a zona tenant (useEffect+useRef, sin re-fetch si igual), modales/AgendaView gated a `timezone` listo, botones disabled hasta cargar. `useState<DateTime>` explícito (luxon `setZone` puede dar `DateTime<false>`).

---

## 5. RPCs públicas consumidas (firmas verificadas)
- `public_get_tenant_by_slug(p_slug text)` → `RETURNS TABLE(id, display_name, branding, timezone, payment_settings)` — usar `.maybeSingle()`.
- `public_get_availability(p_tenant_id, p_from, p_to)` → jsonb `{rules, blocks, busy}`.
- `public_get_live_event(p_tenant_id, p_event_id)` → **jsonb escalar** `{id, title, description, start_at, end_at, price_cents, capacity, seats_taken}` (o null). SIN maybeSingle.
- `public_get_landing(p_tenant_id, p_slug)` → **jsonb escalar** `{id, theme, headline, intro_video_url, body, cta_type, lead_magnet:{id,title,description,file_url}|null}`.
- `public_capture_lead(...12 args...)` → uuid. `current_user_context()` → `RETURNS TABLE(is_professional boolean, tenant_slug text)` (**sin tenant_id**).

---

## 6. Esquema tocado/consumido
- `tenants(id, slug, custom_domain, display_name, branding jsonb, timezone NOT NULL, payment_settings jsonb, status, booking_settings jsonb{lead_time_hours,max_horizon_days})`. **Drift anotado:** `booking_settings` existe en remoto pero no en la migr 001 del repo.
- `appointments(..., status, payment_mode, credit_id→patient_credits, video_room_url, created_by, hold_expires_at, recurrence_group_id, stripe_payment_intent, amount_paid_cents)`.
- `patient_credits(sessions_total, sessions_used, ...)`. `patients(auth_user_id nullable, email, unique(tenant_id,email))`.
- `live_events(title, start_at, end_at, price_cents null|0=gratis, capacity, published, status, video_room_url)`.
- `live_event_registrations(email, name, auth_user_id nullable, payment_status free|pending_payment|paid, stripe_payment_intent, created_at, unique(live_event_id,email))`. RLS: `event_regs_self_select using (auth_user_id = auth.uid())`, `event_regs_pro_all`.

---

## 7. Patrones recurrentes de bug corregidos en los prompts (para calibrar futuros prompts de Opus)
1. **`createClient` de `@/utils/supabase/server` es `async`** → siempre `await`. Los prompts la usaban sin await.
2. **Resolución de tenant host-based** en los prompts originales → el patrón real es `tenant_id`/`slug` en el request (booking). Reescrito.
3. **`exchangeCodeForSession` (PKCE) para OTP server-side** → falla en runtime (el admin client no deja `code_verifier` en el navegador). El patrón correcto es **`token_hash` + `verifyOtp`**. (`/auth/callback` de registro sí es PKCE client-side, no se toca.)
4. **`import 'server-only'`** no está instalado → omitir (rompe build).
5. **`params`/`searchParams` sync** en los prompts → Next 14.2 del repo usa `Promise<...>` + `await`. Además **renombrar** el slug (`tenant`→`tenantSlug`) para no chocar con `const {data: tenant}` del RPC.
6. **Imports adelantados** (componente que importa otro aún no creado) → romper build. Orden real: A2→A1, B3→B2→B1.
7. **`ilike` con email que tiene `_`** → comodín, match de más → `.eq` + `toLowerCase`.
8. **`database.ts` codegen no incluye funciones nuevas** → aumentar a mano o `.rpc` no typechea.
9. **`RETURNS jsonb` escalar vs `RETURNS TABLE`** → `.maybeSingle()` solo en el segundo.
10. **`createDailyRoom` acoplado a `appointmentId`** → generalizado a `{name, startAt, endAt}`.
11. **Middleware** deja pasar segmentos literales (`evento`) sin lista (setea `x-tenant-slug` basura inofensivo; ruta literal gana sobre `[tenant]`) — no requiere cambio.

---

## 8. Deudas técnicas anotadas (no bloquean; decisión de Opus/negocio)
1. **Eventos gratis sin correo/sala:** `events/register` rama gratis retorna `{status:'registered'}` sin mandar correo ni crear sala Daily (solo el camino pagado lo hace, vía webhook). Si el negocio lo quiere → cambio en la rama gratis (carril Opus).
2. **`/mi-cuenta` cross-tenant:** un correo puede ser paciente de varios tenants (`unique(tenant_id,email)`); hoy usa `appointments[0].tenant_id` para la zona. Lo correcto es **zona por-fila**.
3. **Slugs reservados:** no hay validación al crear tenant. Reservar `evento`, `auth`, `api`, `privacidad`, `l`, `login`, `mi-cuenta` cuando abra multi-tenant.
4. **Registro a evento estando ya logueado** no vincula `auth_user_id` (C4 solo cubre vínculo retroactivo en el login). Si se quiere, setear `auth_user_id` en `events/register` cuando haya sesión.
5. **Fuga de asiento por misconfig:** `events/register` toma asiento antes del check de Connect (B4 lo limpia a los 30 min).

---

## 9. Pendientes de OPS (fuera de código — bloquean E2E)
1. **Dashboard Supabase (magic link):** Site URL `https://consulta-plataforma.vercel.app`; Redirect URLs `.../api/patient/link-callback**` + `https://consulta-plataforma-*.vercel.app/**` (previews); Email Templates **"Confirm signup"** y **"Magic Link"** con `{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=signup|magiclink` (NO `{{ .ConfirmationURL }}`).
2. **Vercel env:** `NEXT_PUBLIC_APP_URL=https://consulta-plataforma.vercel.app`, `RESEND_API_KEY`, `RESEND_FROM`, `DAILY_API_KEY`, `DAILY_DOMAIN`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET`, `NEXT_PUBLIC_PRIVACY_VERSION`.
3. **Lead magnet:** subir archivo + URL pública en `lead_magnets.file_url`.
4. **Confirmar slug piloto ≠ `"evento"`:** `select slug, display_name, status from tenants order by created_at;`.

---

## 10. Estado de verificación
- `npx tsc --noEmit` **verde** tras cada prompt (backend y UI).
- Migraciones **017, 018, 019, 020** aplicadas en remoto; funciones dump-verificadas cero-drift; grants e índice post-verificados.
- Sin cambios en lógica de negocio existente (booking, panel citas/recurrencias/créditos) fuera de: 017 (crédito al cancelar), 019 (guarda de ventana), B0 (extracción checkout, cero diff), D0B (timezone en respuesta), generalización `createDailyRoom` (cero diff booking).
