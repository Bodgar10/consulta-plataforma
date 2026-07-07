import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/panel/citas/recurrentes
// Crea N citas recurrentes (todo-o-nada) ligadas por recurrence_group_id.
// Body: {
//   start_at, end_at (ISO UTC; la hora del 1er slot),
//   weekday (0=domingo..6=sábado),
//   occurrences (int, 1..52),
//   patient_id?  | (full_name?, email?, phone?),
//   payment_mode? (default 'external')
// }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.start_at || !body.end_at || body.weekday === undefined || !body.occurrences) {
    return NextResponse.json(
      { error: 'start_at, end_at, weekday y occurrences requeridos' },
      { status: 400 },
    );
  }
  if (!body.patient_id && (!body.full_name || !body.email)) {
    return NextResponse.json({ error: 'da patient_id o (full_name y email)' }, { status: 400 });
  }

  const { data: result, error } = await supabase.rpc('professional_create_recurrence', {
    p_start_at: body.start_at as string,
    p_end_at: body.end_at as string,
    p_weekday: body.weekday as number,
    p_occurrences: body.occurrences as number,
    p_patient_id: (body.patient_id as string) ?? null,
    p_full_name: (body.full_name as string) ?? null,
    p_email: (body.email as string) ?? null,
    p_phone: (body.phone as string) ?? null,
    p_payment_mode: (body.payment_mode as string) ?? 'external',
  });

  if (error) {
    const msg = error.message ?? '';
    if (error.code === '23P01' || msg.includes('Traslape')) {
      return NextResponse.json(
        { error: 'overlap', message: msg || 'Una fecha del lote choca; no se creó ninguna.' },
        { status: 409 },
      );
    }
    if (msg.includes('Paciente no encontrado') || msg.includes('Falta paciente') || msg.includes('weekday') || msg.includes('occurrences')) {
      return NextResponse.json({ error: 'invalid_input', message: msg }, { status: 422 });
    }
    console.error('panel/citas/recurrentes error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  const r = result as { recurrence_group_id: string; created: string[] };
  return NextResponse.json({
    recurrence_group_id: r.recurrence_group_id,
    created: r.created,
    count: r.created?.length ?? 0,
  });
}
