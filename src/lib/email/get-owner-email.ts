import { createAdminClient } from '@/utils/supabase/admin';

/**
 * Obtiene el email del owner del tenant para notificaciones internas.
 * Si hay varios owners, devuelve el primero. NUNCA lanza.
 */
export async function getOwnerEmail(tenantId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from('tenant_members')
      .select('auth_user_id, role')
      .eq('tenant_id', tenantId)
      .eq('role', 'owner')
      .limit(1)
      .single();

    if (!data) return null;

    const { data: user } = await supabase.auth.admin.getUserById(data.auth_user_id);
    return user?.user?.email ?? null;
  } catch {
    return null;
  }
}
