-- ============================================================
-- seed_tenant_profesional.sql  (PLANTILLA · correr con service_role)
-- Crea: auth.user de la profesional + tenant + tenant_members(owner).
-- Reemplaza los <PLACEHOLDERS> antes de ejecutar. Corre dentro de una
-- transacción; revisa el resultado antes del commit.
-- ============================================================
begin;

-- 1) Usuario de auth para la profesional.
--    Respeta NOT NULL: instance_id, aud, role, email, encrypted_password.
with nuevo_user as (
  insert into auth.users (
    instance_id, id, aud, role, email,
    encrypted_password, email_confirmed_at,
    created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    lower('<EMAIL_PROFESIONAL>'),
    crypt('<PASSWORD_TEMPORAL>', gen_salt('bf')),
    now(),
    now(), now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb
  )
  returning id
),

-- 2) Tenant de la profesional.
nuevo_tenant as (
  insert into public.tenants (
    id, slug, display_name, status, timezone,
    branding, payment_settings, booking_settings
  )
  values (
    gen_random_uuid(),
    '<SLUG>',                        -- p.ej. 'nombre-apellido' (subdominio o path)
    '<NOMBRE_PARA_MOSTRAR>',
    'active',
    'America/Mexico_City',           -- zona IANA
    '{}'::jsonb,
    jsonb_build_object(
      'accepts_transfer', true,
      'banco',   '<BANCO>',
      'titular', '<TITULAR>',
      'clabe',   '<CLABE>',
      'whatsapp','<WHATSAPP_E164>',        -- p.ej. '5215555555555'
      'stripe_account_id', '<acct_XXXX>',  -- cuenta Connect de la profesional
      'session_price_cents', <PRECIO_CENTAVOS>  -- p.ej. 80000 = $800.00 MXN
    ),
    '{"lead_time_hours": 12, "max_horizon_days": 60}'::jsonb
  )
  returning id
)

-- 3) Membresía owner (mapea el auth.user al tenant).
insert into public.tenant_members (tenant_id, auth_user_id, role)
select nt.id, nu.id, 'owner'
from nuevo_tenant nt, nuevo_user nu;

-- Revisa lo insertado antes de confirmar:
select t.slug, t.display_name, t.timezone, m.role, u.email
from public.tenants t
join public.tenant_members m on m.tenant_id = t.id
join auth.users u on u.id = m.auth_user_id
where t.slug = '<SLUG>';

-- Si todo se ve bien:  commit;   (si no):  rollback;
commit;
