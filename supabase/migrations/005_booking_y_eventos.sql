-- ============================================================
-- 005_booking_y_eventos.sql
-- Complementos de booking + eventos en vivo grupales.
-- NO toca las migraciones 001-004; las complementa.
-- Correr DESPUÉS de 001-004.
-- ============================================================

-- ------------------------------------------------------------
-- btree_gist: necesario para el EXCLUDE constraint (igualdad de uuid en gist).
-- ------------------------------------------------------------
create extension if not exists btree_gist;

-- ------------------------------------------------------------
-- Blindaje anti-doble-reserva a nivel de motor.
-- Garantiza que no existan dos citas VIVAS traslapadas en el mismo tenant,
-- sin importar la concurrencia. Excluye canceladas/no-show.
-- ------------------------------------------------------------
alter table public.appointments
  add constraint appointments_no_overlap
  exclude using gist (
    tenant_id with =,
    tstzrange(start_at, end_at) with &&
  )
  where (status in ('pending_payment','pending_verification','confirmed','completed'));

-- ------------------------------------------------------------
-- Recurrencias: liga las instancias creadas en bulk (pacientes semanales).
-- Permite "cancelar todas las futuras" sin tocar citas sueltas.
-- ------------------------------------------------------------
alter table public.appointments
  add column recurrence_group_id uuid;

create index idx_appts_recurrence on public.appointments(recurrence_group_id)
  where recurrence_group_id is not null;

-- ------------------------------------------------------------
-- Config de booking por tenant: lead time + horizonte. Defaults sensatos.
-- ------------------------------------------------------------
alter table public.tenants
  add column booking_settings jsonb not null default
    '{"lead_time_hours": 12, "max_horizon_days": 60}'::jsonb;

-- ============================================================
-- EVENTOS EN VIVO GRUPALES (gratis y de pago).
-- Separados de appointments: tienen cupo (no se "ocupan" con 1 reserva)
-- y una sala Daily COMPARTIDA (no una por inscrito).
-- ============================================================

create table public.live_events (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  title           text not null,
  description     text,
  start_at        timestamptz not null,
  end_at          timestamptz not null,
  capacity        int not null default 100 check (capacity > 0),
  price_cents     int,                          -- null o 0 = gratis
  video_room_url  text,                          -- sala Daily compartida
  status          text not null default 'scheduled', -- scheduled | live | done | cancelled
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  check (end_at > start_at)
);
create index idx_events_tenant on public.live_events(tenant_id);

create trigger trg_events_updated
  before update on public.live_events
  for each row execute function public.set_updated_at();

create table public.live_event_registrations (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  live_event_id   uuid not null references public.live_events(id) on delete cascade,
  email           text not null,
  name            text,
  auth_user_id    uuid references auth.users(id) on delete set null,
  payment_status  text not null default 'free', -- free | pending_payment | paid
  stripe_payment_intent text,
  created_at      timestamptz not null default now(),
  unique (live_event_id, email)
);
create index idx_event_regs_tenant on public.live_event_registrations(tenant_id);
create index idx_event_regs_event on public.live_event_registrations(live_event_id);

-- ------------------------------------------------------------
-- RLS — lente profesional (tenant) + el miembro ve sus inscripciones.
-- ------------------------------------------------------------
alter table public.live_events enable row level security;
alter table public.live_event_registrations enable row level security;

create policy events_pro_all on public.live_events
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

create policy event_regs_pro_all on public.live_event_registrations
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy event_regs_self_select on public.live_event_registrations
  for select to authenticated
  using (auth_user_id = auth.uid());

-- ============================================================
-- FUNCIONES PÚBLICAS (anon) — ver evento publicado + registrarse con cupo.
-- ============================================================

create or replace function public.public_get_live_event(p_tenant_id uuid, p_event_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when e.id is null then null else jsonb_build_object(
    'id', e.id, 'title', e.title, 'description', e.description,
    'start_at', e.start_at, 'end_at', e.end_at, 'price_cents', e.price_cents,
    'capacity', e.capacity,
    'seats_taken', (
      select count(*) from public.live_event_registrations r
      where r.live_event_id = e.id
        and r.payment_status in ('free','paid','pending_payment')
    )
  ) end
  from public.live_events e
  where e.id = p_event_id and e.tenant_id = p_tenant_id
    and e.published and e.status = 'scheduled'
$$;

-- Registro con control de cupo. Para eventos de pago deja pending_payment
-- (el webhook de Stripe lo pasa a 'paid'); para gratis, queda 'free'.
create or replace function public.public_register_live_event(
  p_tenant_id uuid,
  p_event_id uuid,
  p_email text,
  p_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_capacity int;
  v_price int;
  v_taken int;
  v_reg_id uuid;
  v_status text;
begin
  select capacity, price_cents into v_capacity, v_price
  from public.live_events
  where id = p_event_id and tenant_id = p_tenant_id
    and published and status = 'scheduled'
  for update;  -- lock de la fila del evento para serializar el conteo de cupo

  if v_capacity is null then
    raise exception 'Evento no disponible';
  end if;

  select count(*) into v_taken
  from public.live_event_registrations
  where live_event_id = p_event_id
    and payment_status in ('free','paid','pending_payment');

  if v_taken >= v_capacity then
    raise exception 'El evento está lleno';
  end if;

  v_status := case when coalesce(v_price,0) = 0 then 'free' else 'pending_payment' end;

  insert into public.live_event_registrations (
    tenant_id, live_event_id, email, name, payment_status
  )
  values (p_tenant_id, p_event_id, lower(p_email), p_name, v_status)
  on conflict (live_event_id, email) do update
    set name = coalesce(excluded.name, public.live_event_registrations.name)
  returning id into v_reg_id;

  return v_reg_id;
end;
$$;

grant execute on function public.public_get_live_event(uuid, uuid) to anon, authenticated;
grant execute on function public.public_register_live_event(uuid, uuid, text, text) to anon, authenticated;
