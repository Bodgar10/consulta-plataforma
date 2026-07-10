import { createAdminClient } from '@/utils/supabase/admin';

export type TenantContext = {
  tenant_id: string;
  slug: string | null;
  display_name: string | null;
  timezone: string;   // IANA. Nunca offset, nunca hardcode.
  currency: string;   // ISO 4217 para UI; el DINERO usa PAYMENTS_CONFIG.currency ('mxn'), no esto.
};

/**
 * Fuente única de contexto del tenant server-side, por tenant_id (patrón de
 * booking/create: el id llega en el request). Vía createAdminClient + lectura
 * directa de tenants. LANZA si falta zona: es bug de config, no un caso a
 * "adivinar" con CDMX.
 */
export async function getTenantContextById(tenantId: string): Promise<TenantContext> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tenants')
    .select('id, slug, display_name, timezone')
    .eq('id', tenantId)
    .eq('status', 'active')
    .single();
  if (error || !data?.timezone) {
    throw new Error('TenantContext: tenant o timezone no disponible');
  }
  return {
    tenant_id: data.id,
    slug: data.slug ?? null,
    display_name: data.display_name ?? null,
    timezone: data.timezone,
    currency: 'MXN',
  };
}
