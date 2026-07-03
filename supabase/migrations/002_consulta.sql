-- ============================================================
-- 002_consulta.sql
-- Frente 1: gestión de consulta.
-- patients, packages, patient_credits, availability_rules,
-- availability_blocks, appointments.
-- + 2da lente de RLS (paciente) + funciones públicas de booking.
-- ============================================================

-- ------------------------------------------------------------
-- patients — el paciente NO es usuario hasta que hay saldo/historial.
-- auth_user_id se llena al vincular cuenta (magic link).
-- ------------------------------------------------------------
create table public.patients (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  full_name        text not null,
  email            text not null,
  phone            text,
  notas_operativas text,                          -- NIVEL 2: operativo, NUNCA clínico (empuje en UI)
  auth_user_id     uuid references auth.users(id) on delete set null,  -- nullable; vinculación
  timezone         text,
  -- lead_id se agrega en 003 (puente embudo -> paciente)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, email)                        -- dedup + llave de vinculación
);

create index idx_patients_tenant on public.patients(tenant_id);
create index idx_patients_auth_user on public.patients(auth_user_id);

create trigger trg_patients_updated
  before update on public.patients
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- packages — catálogo de paquetes. Sesión suelta = sessions_count 1.
-- ------------------------------------------------------------
create table public.packages (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  name           text not null,
  sessions_count int not null check (sessions_count > 0),
  price_cents    int not null check (price_cents >= 0),
  valid_days     int not null default 180,        -- vencimiento declarado (default 6 meses)
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

create index idx_packages_tenant on public.packages(tenant_id);

-- ------------------------------------------------------------
-- patient_credits — una compra de paquete (saldo prepagado).
-- status 'pending' cuando es por transferencia esperando confirmación de mamá.
-- ------------------------------------------------------------
create table public.patient_credits (
  id                    uuid primary key default gen_random_uuid(),
  tenant_id             uuid not null references public.tenants(id) on delete cascade,
  patient_id            uuid not null references public.patients(id) on delete cascade,
  package_id            uuid not null references public.packages(id),
  sessions_total        int not null check (sessions_total > 0),
  sessions_used         int not null default 0 check (sessions_used >= 0),
  expires_at            timestamptz not null,
  amount_paid_cents     int not null default 0,
  stripe_payment_intent text,
  status                text not null default 'pending',  -- pending | active | expired | refunded
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  check (sessions_used <= sessions_total)
);

create index idx_credits_tenant on public.patient_credits(tenant_id);
create index idx_credits_patient on public.patient_credits(patient_id);

create trigger trg_credits_updated
  before update on public.patient_credits
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- availability_rules — disponibilidad recurrente semanal.
-- weekday: 0=domingo ... 6=sábado. La expansión a slots (zonas horarias,
-- buffers) se hace en app / función refinada en bloque 7.
-- ------------------------------------------------------------
create table public.availability_rules (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  weekday         int not null check (weekday between 0 and 6),
  start_time      time not null,
  end_time        time not null,
  slot_minutes    int not null default 50,
  buffer_minutes  int not null default 10,
  created_at      timestamptz not null default now(),
  check (end_time > start_time)
);

create index idx_avail_rules_tenant on public.availability_rules(tenant_id);

-- ------------------------------------------------------------
-- availability_blocks — días/horas bloqueadas (vacaciones, ad-hoc).
-- ------------------------------------------------------------
create table public.availability_blocks (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  start_at    timestamptz not null,
  end_at      timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now(),
  check (end_at > start_at)
);

create index idx_avail_blocks_tenant on public.availability_blocks(tenant_id);

-- ------------------------------------------------------------
-- appointments — el corazón. Dos regímenes conviven aquí:
--  - autoservicio (created_by='patient'): reglas automáticas + hold_expires_at.
--  - profesional (created_by='professional'): override total, hold_expires_at NULL.
-- ------------------------------------------------------------
create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         uuid not null references public.tenants(id) on delete cascade,
  patient_id        uuid not null references public.patients(id) on delete cascade,
  start_at          timestamptz not null,          -- siempre en UTC
  end_at            timestamptz not null,
  status            text not null default 'pending_payment',
                    -- pending_payment | pending_verification | confirmed | completed | cancelled | no_show
  payment_mode      text not null default 'single', -- single | credit | transfer | external
  credit_id         uuid references public.patient_credits(id) on delete set null,
  amount_paid_cents int,
  video_room_url    text,
  created_by        text not null default 'patient', -- patient | professional
  hold_expires_at   timestamptz,                     -- NULL = nunca auto-cancela (manual / perdonado)
  verified_by       uuid references auth.users(id),  -- quién confirmó pago manual
  verified_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (end_at > start_at)
);

create index idx_appts_tenant on public.appointments(tenant_id);
create index idx_appts_patient on public.appointments(patient_id);
create index idx_appts_start on public.appointments(tenant_id, start_at);
-- Para el cron de auto-cancel: solo persigue holds vivos de autoservicio.
create index idx_appts_holds on public.appointments(hold_expires_at)
  where hold_expires_at is not null and status = 'pending_verification';

create trigger trg_appts_updated
  before update on public.appointments
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- 2da lente de RLS: patient_ids del usuario autenticado.
-- security definer para evitar recursión al evaluar políticas sobre patients.
-- ------------------------------------------------------------
create or replace function public.current_user_patient_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id
  from public.patients
  where auth_user_id = auth.uid()
$$;

-- ------------------------------------------------------------
-- RLS — lente profesional (tenant) + lente paciente (filas propias).
-- Las políticas son permisivas: se combinan con OR.
-- ------------------------------------------------------------
alter table public.patients          enable row level security;
alter table public.packages          enable row level security;
alter table public.patient_credits   enable row level security;
alter table public.availability_rules  enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.appointments      enable row level security;

-- patients
create policy patients_pro_all on public.patients
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy patients_self_select on public.patients
  for select to authenticated
  using (id in (select public.current_user_patient_ids()));

-- packages (catálogo lo administra el profesional; lectura pública vía función)
create policy packages_pro_all on public.packages
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- patient_credits
create policy credits_pro_all on public.patient_credits
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy credits_self_select on public.patient_credits
  for select to authenticated
  using (patient_id in (select public.current_user_patient_ids()));

-- availability (solo profesional administra; lectura pública vía función)
create policy avail_rules_pro_all on public.availability_rules
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy avail_blocks_pro_all on public.availability_blocks
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- appointments
create policy appts_pro_all on public.appointments
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy appts_self_select on public.appointments
  for select to authenticated
  using (patient_id in (select public.current_user_patient_ids()));

-- ============================================================
-- FUNCIONES PÚBLICAS (anon) — booking sin login.
-- El rol anónimo NO toca tablas directo: solo EXECUTE sobre estas
-- funciones security definer (que bypassan RLS de forma controlada).
-- ============================================================

-- Datos públicos del tenant por slug (para landing / página de booking).
create or replace function public.public_get_tenant_by_slug(p_slug text)
returns table (id uuid, display_name text, branding jsonb, timezone text, payment_settings jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.display_name, t.branding, t.timezone,
         -- solo exponemos lo necesario para mostrar opciones de pago, no credenciales
         jsonb_build_object(
           'accepts_transfer', coalesce(t.payment_settings->>'accepts_transfer','false')::boolean,
           'whatsapp', t.payment_settings->>'whatsapp',
           'banco', t.payment_settings->>'banco',
           'titular', t.payment_settings->>'titular',
           'clabe', t.payment_settings->>'clabe'
         )
  from public.tenants t
  where t.slug = p_slug and t.status = 'active'
$$;

-- Disponibilidad cruda + ocupado en una ventana (sin datos de paciente).
-- La expansión a slots concretos vive en app (bloque 7).
create or replace function public.public_get_availability(
  p_tenant_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'rules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'weekday', r.weekday, 'start_time', r.start_time, 'end_time', r.end_time,
        'slot_minutes', r.slot_minutes, 'buffer_minutes', r.buffer_minutes))
      from public.availability_rules r where r.tenant_id = p_tenant_id
    ), '[]'::jsonb),
    'blocks', coalesce((
      select jsonb_agg(jsonb_build_object('start_at', b.start_at, 'end_at', b.end_at))
      from public.availability_blocks b
      where b.tenant_id = p_tenant_id and b.end_at >= p_from and b.start_at <= p_to
    ), '[]'::jsonb),
    'busy', coalesce((
      select jsonb_agg(jsonb_build_object('start_at', a.start_at, 'end_at', a.end_at))
      from public.appointments a
      where a.tenant_id = p_tenant_id
        and a.status in ('pending_payment','pending_verification','confirmed','completed')
        and a.end_at >= p_from and a.start_at <= p_to
    ), '[]'::jsonb)
  )
$$;

-- Crea (o reusa) paciente anónimo + cita en hold. NO confirma ni genera sala:
-- eso ocurre en el webhook de Stripe (pago) o al confirmar mamá (transferencia).
create or replace function public.public_create_appointment(
  p_tenant_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_full_name text,
  p_email text,
  p_phone text,
  p_payment_mode text  -- 'single' (Stripe) | 'transfer'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_patient_id uuid;
  v_appt_id uuid;
  v_status text;
begin
  if p_payment_mode not in ('single','transfer') then
    raise exception 'payment_mode inválido para booking público';
  end if;

  -- Guard de concurrencia: no permitir traslape con cita viva.
  if exists (
    select 1 from public.appointments a
    where a.tenant_id = p_tenant_id
      and a.status in ('pending_payment','pending_verification','confirmed','completed')
      and a.start_at < p_end_at and a.end_at > p_start_at
  ) then
    raise exception 'El horario ya no está disponible';
  end if;

  -- Upsert de paciente por (tenant, email), sin auth_user_id (anónimo).
  insert into public.patients (tenant_id, full_name, email, phone)
  values (p_tenant_id, p_full_name, lower(p_email), p_phone)
  on conflict (tenant_id, email)
  do update set full_name = excluded.full_name,
                phone = coalesce(excluded.phone, public.patients.phone)
  returning id into v_patient_id;

  v_status := case when p_payment_mode = 'transfer'
                   then 'pending_verification' else 'pending_payment' end;

  insert into public.appointments (
    tenant_id, patient_id, start_at, end_at, status,
    payment_mode, created_by, hold_expires_at
  )
  values (
    p_tenant_id, v_patient_id, p_start_at, p_end_at, v_status,
    p_payment_mode, 'patient', now() + interval '24 hours'
  )
  returning id into v_appt_id;

  return v_appt_id;
end;
$$;

grant execute on function public.public_get_tenant_by_slug(text) to anon, authenticated;
grant execute on function public.public_get_availability(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.public_create_appointment(uuid, timestamptz, timestamptz, text, text, text, text) to anon, authenticated;
