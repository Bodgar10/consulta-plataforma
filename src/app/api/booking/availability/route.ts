import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { generateSlots, type AvailabilityPayload, type BookingSettings } from '@/lib/booking/slots';

export const dynamic = 'force-dynamic';

/**
 * GET /api/booking/availability?tenant_id=...&from=ISO&to=ISO
 * Devuelve { slots: [{start,end}], timezone }.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenant_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!tenantId || !from || !to) {
    return NextResponse.json({ error: 'faltan tenant_id, from o to' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: tenant, error: tErr } = await supabase
    .from('tenants')
    .select('timezone, booking_settings')
    .eq('id', tenantId)
    .eq('status', 'active')
    .single();

  if (tErr || !tenant) {
    return NextResponse.json({ error: 'tenant no encontrado' }, { status: 404 });
  }

  const { data: availability, error: aErr } = await supabase.rpc('public_get_availability', {
    p_tenant_id: tenantId,
    p_from: from,
    p_to: to,
  });

  if (aErr) {
    return NextResponse.json({ error: 'no se pudo leer disponibilidad' }, { status: 500 });
  }

  const timezone = (tenant.timezone as string) || 'America/Mexico_City';
  const settings = (tenant.booking_settings as unknown as BookingSettings) ?? {
    lead_time_hours: 12,
    max_horizon_days: 60,
  };

  const slots = generateSlots({
    availability: (availability as unknown as AvailabilityPayload) ?? { rules: [], blocks: [], busy: [] },
    timezone,
    settings,
    from,
    to,
  });

  return NextResponse.json({ slots, timezone });
}
