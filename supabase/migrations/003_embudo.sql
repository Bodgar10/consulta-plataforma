-- ============================================================
-- 003_embudo.sql
-- Frente 2: embudo desde YouTube.
-- landing_pages, lead_magnets, leads, email_sequences,
-- sequence_steps, sequence_enrollments.
-- + puente lead -> paciente (ALTER patients) + captura pública de leads.
-- ============================================================

-- ------------------------------------------------------------
-- lead_magnets — PDF/recurso descargable a cambio de correo.
-- ------------------------------------------------------------
create table public.lead_magnets (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  title       text not null,
  slug        text not null,
  file_url    text not null,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_magnets_tenant on public.lead_magnets(tenant_id);

-- ------------------------------------------------------------
-- landing_pages — una por tema fuerte del canal.
-- intro_video_url = embed de YouTube (no pasa por hosting de cursos).
-- ------------------------------------------------------------
create table public.landing_pages (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  slug            text not null,
  theme           text,
  headline        text not null,
  intro_video_url text,
  body            jsonb not null default '{}'::jsonb,
  lead_magnet_id  uuid references public.lead_magnets(id) on delete set null,
  cta_type        text not null default 'book',   -- book | magnet
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_landings_tenant on public.landing_pages(tenant_id);

create trigger trg_landings_updated
  before update on public.landing_pages
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- leads — el corazón del CRM. UTM congelado al capturar.
-- ------------------------------------------------------------
create table public.leads (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  email            text not null,
  name             text,
  phone            text,
  landing_page_id  uuid references public.landing_pages(id) on delete set null,
  lead_magnet_id   uuid references public.lead_magnets(id) on delete set null,
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  referrer         text,
  status           text not null default 'new',  -- new | nurturing | booked | converted | lost
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (tenant_id, email)
);
create index idx_leads_tenant on public.leads(tenant_id);

create trigger trg_leads_updated
  before update on public.leads
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- Puente lead -> paciente. patient.lead_id apunta de vuelta al lead.
-- Reporte: patient -> lead -> utm = qué video trajo a cada paciente.
-- ------------------------------------------------------------
alter table public.patients
  add column lead_id uuid references public.leads(id) on delete set null;
create index idx_patients_lead on public.patients(lead_id);

-- ------------------------------------------------------------
-- Motor de secuencias (mismo patrón cron+Resend del aviso PROFECO de Pasas).
-- ------------------------------------------------------------
create table public.email_sequences (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  trigger     text not null,                  -- p.ej. 'magnet_downloaded'
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index idx_sequences_tenant on public.email_sequences(tenant_id);

create table public.sequence_steps (
  id           uuid primary key default gen_random_uuid(),
  sequence_id  uuid not null references public.email_sequences(id) on delete cascade,
  step_order   int not null,
  delay_hours  int not null default 0,
  subject      text not null,
  body_template text not null,
  created_at   timestamptz not null default now(),
  unique (sequence_id, step_order)
);

create table public.sequence_enrollments (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  sequence_id  uuid not null references public.email_sequences(id) on delete cascade,
  current_step int not null default 0,
  status       text not null default 'active', -- active | completed | unsubscribed
  next_send_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index idx_enrollments_tenant on public.sequence_enrollments(tenant_id);
-- Para el cron de envío: enrollments listos para mandar.
create index idx_enrollments_due on public.sequence_enrollments(next_send_at)
  where status = 'active';

create trigger trg_seq_enroll_updated
  before update on public.sequence_enrollments
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- RLS — todo el frente es del profesional (lente tenant).
-- Las landings/magnets se sirven al público vía funciones definer.
-- El paciente no toca nada de este frente.
-- ------------------------------------------------------------
alter table public.lead_magnets          enable row level security;
alter table public.landing_pages         enable row level security;
alter table public.leads                 enable row level security;
alter table public.email_sequences       enable row level security;
alter table public.sequence_steps        enable row level security;
alter table public.sequence_enrollments  enable row level security;

create policy magnets_pro_all on public.lead_magnets
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

create policy landings_pro_all on public.landing_pages
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

create policy leads_pro_all on public.leads
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

create policy sequences_pro_all on public.email_sequences
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- sequence_steps no tiene tenant_id directo: se scopea vía su secuencia.
create policy steps_pro_all on public.sequence_steps
  for all to authenticated
  using (
    sequence_id in (
      select id from public.email_sequences
      where tenant_id in (select public.current_user_tenant_ids())
    )
  )
  with check (
    sequence_id in (
      select id from public.email_sequences
      where tenant_id in (select public.current_user_tenant_ids())
    )
  );

create policy enrollments_pro_all on public.sequence_enrollments
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- ============================================================
-- FUNCIONES PÚBLICAS (anon) — landing + captura de lead.
-- ============================================================

-- Landing publicada por (tenant, slug) + su lead magnet, para render público.
create or replace function public.public_get_landing(p_tenant_id uuid, p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select case when lp.id is null then null else jsonb_build_object(
    'id', lp.id, 'theme', lp.theme, 'headline', lp.headline,
    'intro_video_url', lp.intro_video_url, 'body', lp.body, 'cta_type', lp.cta_type,
    'lead_magnet', case when lm.id is null then null else jsonb_build_object(
      'id', lm.id, 'title', lm.title, 'description', lm.description, 'file_url', lm.file_url
    ) end
  ) end
  from public.landing_pages lp
  left join public.lead_magnets lm on lm.id = lp.lead_magnet_id and lm.active
  where lp.tenant_id = p_tenant_id and lp.slug = p_slug and lp.published
$$;

-- Captura de lead (upsert por tenant+email) con UTM. Devuelve el id del lead.
create or replace function public.public_capture_lead(
  p_tenant_id uuid,
  p_email text,
  p_name text,
  p_phone text,
  p_landing_page_id uuid,
  p_lead_magnet_id uuid,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_content text,
  p_utm_term text,
  p_referrer text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead_id uuid;
begin
  insert into public.leads (
    tenant_id, email, name, phone, landing_page_id, lead_magnet_id,
    utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer
  )
  values (
    p_tenant_id, lower(p_email), p_name, p_phone, p_landing_page_id, p_lead_magnet_id,
    p_utm_source, p_utm_medium, p_utm_campaign, p_utm_content, p_utm_term, p_referrer
  )
  on conflict (tenant_id, email) do update
    set name = coalesce(excluded.name, public.leads.name),
        phone = coalesce(excluded.phone, public.leads.phone),
        -- no pisamos el UTM original: la primera atribución manda
        updated_at = now()
  returning id into v_lead_id;

  return v_lead_id;
end;
$$;

grant execute on function public.public_get_landing(uuid, text) to anon, authenticated;
grant execute on function public.public_capture_lead(uuid, text, text, text, uuid, uuid, text, text, text, text, text, text) to anon, authenticated;
