-- ============================================================
-- 015_issue_credit.sql
-- Sprint 2b · Emitir crédito manual (carril Opus). La profesional ya cobró por
-- fuera (efectivo/transferencia) y registra el saldo prepagado. Nace 'active'.
-- expires_at se calcula server-side desde packages.valid_days (verdad legal,
-- no ajustable por cliente). Snapshot de sessions_total desde el paquete.
-- Valida que paciente y paquete sean del MISMO tenant de la sesión.
-- ============================================================

create or replace function public.professional_issue_credit(
  p_patient_id uuid,
  p_package_id uuid,
  p_amount_paid_cents int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant_id uuid;
  v_sessions int;
  v_valid_days int;
  v_credit_id uuid;
begin
  select tid into v_tenant_id
  from public.current_user_tenant_ids() as tid
  limit 1;
  if v_tenant_id is null then
    raise exception 'Sin tenant en la sesión';
  end if;

  -- Paciente del tenant.
  if not exists (
    select 1 from public.patients
    where id = p_patient_id and tenant_id = v_tenant_id
  ) then
    raise exception 'Paciente no encontrado en tu consulta';
  end if;

  -- Paquete del tenant + snapshot de sus valores.
  select sessions_count, valid_days into v_sessions, v_valid_days
  from public.packages
  where id = p_package_id and tenant_id = v_tenant_id and active = true;

  if v_sessions is null then
    raise exception 'Paquete no encontrado, inactivo, o de otra consulta';
  end if;

  insert into public.patient_credits (
    tenant_id, patient_id, package_id,
    sessions_total, sessions_used, expires_at,
    amount_paid_cents, status
  )
  values (
    v_tenant_id, p_patient_id, p_package_id,
    v_sessions, 0, now() + make_interval(days => v_valid_days),
    coalesce(p_amount_paid_cents, 0), 'active'
  )
  returning id into v_credit_id;

  return jsonb_build_object(
    'credit_id', v_credit_id,
    'sessions_total', v_sessions,
    'expires_at', (now() + make_interval(days => v_valid_days))
  );
end;
$$;

grant execute on function public.professional_issue_credit(uuid, uuid, int) to authenticated;
