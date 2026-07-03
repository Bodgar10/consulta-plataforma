import { createAdminClient } from '@/utils/supabase/admin';

interface LinkArgs {
  tenantId: string;
  email: string;
  password: string;
}

/**
 * Crea (o reutiliza) un auth.user para el paciente y lo liga por (tenant, email).
 * Idempotente y tolerante a fallos: NUNCA lanza (la reserva ya se creó; la cuenta
 * es un extra opcional). Si el correo ya existe, solo asegura auth_user_id.
 */
export async function linkPatientAccount(args: LinkArgs): Promise<void> {
  const supabase = createAdminClient();
  const email = args.email.toLowerCase();

  try {
    let authUserId: string | undefined;

    // Intentar crear el usuario (confirmado, sin flujo de verificación en el piloto).
    const { data: created, error: cErr } = await supabase.auth.admin.createUser({
      email,
      password: args.password,
      email_confirm: true,
    });

    if (created?.user) {
      authUserId = created.user.id;
    } else if (cErr) {
      // Ya existe: buscarlo por email para obtener su id.
      const { data: list } = await supabase.auth.admin.listUsers();
      authUserId = list?.users?.find((u) => u.email?.toLowerCase() === email)?.id;
    }

    if (!authUserId) return;

    // Ligar el paciente de ESTE tenant por email (no pisa otros tenants).
    await supabase
      .from('patients')
      .update({ auth_user_id: authUserId })
      .eq('tenant_id', args.tenantId)
      .eq('email', email)
      .is('auth_user_id', null);
  } catch (err) {
    console.error('link-account: excepción (no crítica)', err);
  }
}
