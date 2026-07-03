-- ============================================================
-- 004_cursos.sql
-- Frente 3: cursos y membresía. SCHEMA día uno; BUILD en fase 2.
-- courses, lessons, membership_plans, enrollments, memberships,
-- lesson_progress, certificates, lesson_comments.
--
-- NOTA: el catálogo público (browse) y el gating de video_asset_id
-- se refinan en fase 2 (URLs firmadas de Bunny + función de entitlement).
-- Aquí dejamos lente profesional + lente miembro.
-- ============================================================

-- ------------------------------------------------------------
-- courses
-- ------------------------------------------------------------
create table public.courses (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  slug            text not null,
  title           text not null,
  description     text,
  cover_image_url text,
  access_type     text not null default 'one_time',  -- free | one_time | membership
  price_cents     int,
  published       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (tenant_id, slug)
);
create index idx_courses_tenant on public.courses(tenant_id);

create trigger trg_courses_updated
  before update on public.courses
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- lessons — video_asset_id apunta a Bunny Stream (proveedor elegido).
-- ------------------------------------------------------------
create table public.lessons (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  course_id        uuid not null references public.courses(id) on delete cascade,
  position         int not null default 0,
  title            text not null,
  video_asset_id   text,                       -- id de Bunny
  duration_seconds int,
  drip_days        int not null default 0,     -- días tras inscripción para desbloquear
  free_preview     boolean not null default false,
  created_at       timestamptz not null default now()
);
create index idx_lessons_course on public.lessons(course_id);
create index idx_lessons_tenant on public.lessons(tenant_id);

-- ------------------------------------------------------------
-- membership_plans — suscripción recurrente (patrón Pasas).
-- ------------------------------------------------------------
create table public.membership_plans (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  price_cents     int not null,
  interval        text not null default 'month',
  stripe_price_id text,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);
create index idx_plans_tenant on public.membership_plans(tenant_id);

-- ------------------------------------------------------------
-- enrollments — acceso a un curso. expires_at NULL = permanente (pago único).
-- ------------------------------------------------------------
create table public.enrollments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  course_id     uuid not null references public.courses(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  email         text not null,
  source        text not null default 'one_time', -- one_time | membership | manual
  status        text not null default 'active',
  expires_at    timestamptz,
  created_at    timestamptz not null default now(),
  unique (course_id, auth_user_id)
);
create index idx_enrollments_user on public.enrollments(auth_user_id);
create index idx_enrollments_tenant_c on public.enrollments(tenant_id);

-- ------------------------------------------------------------
-- memberships — suscripción activa a un plan (espejo de subscriptions de Pasas).
-- ------------------------------------------------------------
create table public.memberships (
  id                   uuid primary key default gen_random_uuid(),
  tenant_id            uuid not null references public.tenants(id) on delete cascade,
  auth_user_id         uuid not null references auth.users(id) on delete cascade,
  email                text not null,
  membership_plan_id   uuid not null references public.membership_plans(id),
  stripe_subscription_id text,
  status               text not null default 'active', -- active | cancelled | past_due
  current_period_end   timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index idx_memberships_user on public.memberships(auth_user_id);
create index idx_memberships_tenant on public.memberships(tenant_id);

create trigger trg_memberships_updated
  before update on public.memberships
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------
-- lesson_progress — alimenta drip y certificados.
-- ------------------------------------------------------------
create table public.lesson_progress (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  completed_at  timestamptz not null default now(),
  unique (auth_user_id, lesson_id)
);
create index idx_progress_user on public.lesson_progress(auth_user_id);

-- ------------------------------------------------------------
-- certificates
-- ------------------------------------------------------------
create table public.certificates (
  id               uuid primary key default gen_random_uuid(),
  tenant_id        uuid not null references public.tenants(id) on delete cascade,
  course_id        uuid not null references public.courses(id) on delete cascade,
  auth_user_id     uuid not null references auth.users(id) on delete cascade,
  issued_at        timestamptz not null default now(),
  certificate_url  text,
  unique (course_id, auth_user_id)
);
create index idx_certs_user on public.certificates(auth_user_id);

-- ------------------------------------------------------------
-- lesson_comments — comunidad por lección (hilos vía parent_id).
-- ------------------------------------------------------------
create table public.lesson_comments (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,
  lesson_id     uuid not null references public.lessons(id) on delete cascade,
  auth_user_id  uuid not null references auth.users(id) on delete cascade,
  body          text not null,
  parent_id     uuid references public.lesson_comments(id) on delete cascade,
  created_at    timestamptz not null default now()
);
create index idx_comments_lesson on public.lesson_comments(lesson_id);

-- ------------------------------------------------------------
-- RLS — lente profesional (tenant) + lente miembro (filas propias por auth.uid()).
-- ------------------------------------------------------------
alter table public.courses          enable row level security;
alter table public.lessons          enable row level security;
alter table public.membership_plans enable row level security;
alter table public.enrollments      enable row level security;
alter table public.memberships      enable row level security;
alter table public.lesson_progress  enable row level security;
alter table public.certificates     enable row level security;
alter table public.lesson_comments  enable row level security;

-- courses / lessons / plans: el profesional administra todo su tenant.
create policy courses_pro_all on public.courses
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy lessons_pro_all on public.lessons
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy plans_pro_all on public.membership_plans
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));

-- enrollments / memberships / progress / certificates:
-- profesional ve todo su tenant; el miembro ve/gestiona lo suyo.
create policy enroll_pro_all on public.enrollments
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy enroll_self_select on public.enrollments
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy memb_pro_all on public.memberships
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy memb_self_select on public.memberships
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy progress_pro_select on public.lesson_progress
  for select to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()));
create policy progress_self_all on public.lesson_progress
  for all to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy certs_pro_all on public.certificates
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy certs_self_select on public.certificates
  for select to authenticated
  using (auth_user_id = auth.uid());

-- comentarios: profesional modera todo su tenant; el miembro escribe los suyos.
-- (Visibilidad de hilos completos por inscripción se refina en fase 2.)
create policy comments_pro_all on public.lesson_comments
  for all to authenticated
  using (tenant_id in (select public.current_user_tenant_ids()))
  with check (tenant_id in (select public.current_user_tenant_ids()));
create policy comments_self_write on public.lesson_comments
  for insert to authenticated
  with check (auth_user_id = auth.uid());
create policy comments_self_select on public.lesson_comments
  for select to authenticated
  using (auth_user_id = auth.uid());
