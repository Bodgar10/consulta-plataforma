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
//                    video_room_url, created_by, patient: { id, full_name } }] }
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

  return NextResponse.json({ appointments: data ?? [] });
}
