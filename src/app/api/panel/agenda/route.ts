import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/panel/agenda?from=ISO&to=ISO
// Lectura de la agenda de la profesional: citas del tenant en un rango.
// Cliente authenticated => la RLS (lente profesional) ya aísla por tenant;
// no filtramos tenant_id a mano. Sin sesión => 401.
//
// Contrato de respuesta:
// { appointments: [{ id, start_at, end_at, status, payment_mode,
//                    video_room_url, created_by, patient: { id, full_name } }],
//   timezone: "America/Mexico_City" }  // IANA del tenant de la sesión
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  if (!from || !to) {
    return NextResponse.json({ error: 'from y to (ISO) requeridos' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, start_at, end_at, status, payment_mode, video_room_url, created_by, recurrence_group_id, patient:patients(id, full_name)')
    .gte('start_at', from)
    .lte('start_at', to)
    .order('start_at', { ascending: true });

  if (error) {
    console.error('panel/agenda error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  // Zona del tenant de la sesión (la RLS de tenants ya lo aísla al del profesional).
  // Mismo manejo defensivo que /api/booking/availability: si falta la zona (imposible
  // en la práctica, tenants.timezone es NOT NULL) -> 400 explícito, no asumir CDMX.
  const { data: tenantRow } = await supabase
    .from('tenants')
    .select('timezone')
    .limit(1)
    .maybeSingle();
  const timezone = tenantRow?.timezone ?? null;
  if (!timezone) {
    return NextResponse.json({ error: 'tenant_timezone_missing' }, { status: 400 });
  }

  return NextResponse.json({ appointments: data ?? [], timezone });
}
