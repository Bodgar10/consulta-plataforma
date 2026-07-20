-- ============================================================
-- 041_pdf_workshops.sql
-- Talleres descargables en PDF (gratis o de pago), separados de
-- los eventos en vivo. Los de pago pueden otorgar una sesión de
-- terapia gratis (grants_free_session), implementada como un
-- crédito normal de patient_credits contra un paquete interno
-- oculto (is_public=false) — no se muestra en la vitrina de
-- precios. source_workshop_id en patient_credits permite mostrar
-- "Cita por compra del taller: X" en la Agenda de la profesional.
-- Storage bucket privado; la descarga siempre se sirve por link
-- firmado generado por el backend, nunca acceso público directo.
-- Extiende public_get_packages (030) para excluir is_public=false
-- de la vitrina pública de precios.
-- ============================================================

-- 1. Ocultar paquetes "internos" de la vitrina pública de precios
alter table public.packages
  add column is_public boolean not null default true;

-- 2. Tabla de talleres descargables (PDF)
create table public.pdf_workshops (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  description text,
  price_cents integer,
  file_path text,
  grants_free_session boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Registro de quién descargó/compró cada taller
create table public.pdf_workshop_downloads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  workshop_id uuid not null references public.pdf_workshops(id) on delete cascade,
  email text not null,
  name text,
  auth_user_id uuid,
  payment_status text not null default 'free',
  stripe_payment_intent text,
  credit_id uuid references public.patient_credits(id),
  created_at timestamptz not null default now()
);

-- 4. Recordar de qué taller vino un crédito
alter table public.patient_credits
  add column source_workshop_id uuid references public.pdf_workshops(id);

-- 5. RLS: mismo patrón que el resto del proyecto
alter table public.pdf_workshops enable row level security;
alter table public.pdf_workshop_downloads enable row level security;

create policy pdf_workshops_pro_all on public.pdf_workshops
  for all using (tenant_id in (select current_user_tenant_ids()));

create policy pdf_workshop_downloads_pro_all on public.pdf_workshop_downloads
  for all using (tenant_id in (select current_user_tenant_ids()));

-- 6. Bucket de Storage para los PDFs (privado)
insert into storage.buckets (id, name, public)
values ('pdf-workshops', 'pdf-workshops', false);

-- 7. Solo miembros del tenant pueden subir/editar/borrar archivos de SU tenant.
-- NO se otorga ningún acceso a anon aquí — la descarga real nunca pasa por esta
-- policy, siempre por un link firmado (createSignedUrl) generado por el backend
-- con la service role, que evade RLS de Storage a propósito.
create policy "tenant members manage their workshop files"
on storage.objects for all
using (
  bucket_id = 'pdf-workshops'
  and (storage.foldername(name))[1]::uuid in (select current_user_tenant_ids())
);

-- 8. public_get_packages excluye paquetes internos (is_public=false) de la
-- vitrina pública de precios.
create or replace function public.public_get_packages(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'sessions_count', p.sessions_count,
      'price_cents', p.price_cents,
      'valid_days', p.valid_days
    ) order by p.sessions_count
  ), '[]'::jsonb)
  from public.packages p
  where p.tenant_id = p_tenant_id and p.active and p.is_public
$$;
