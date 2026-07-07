import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// PATCH /api/panel/agenda/[id]
// Cancelar o reagendar una cita existente.
// Body cancelar:   { status: 'cancelled' }
// Body reagendar:  { start_at, end_at }  (ISO UTC)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'falta appointment id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: 'body requerido' }, { status: 400 });
  }

  const isCancel = body.status === 'cancelled';
  const isReschedule = !!body.start_at && !!body.end_at;
  if (!isCancel && !isReschedule) {
    return NextResponse.json(
      { error: "manda { status:'cancelled' } o { start_at, end_at }" },
      { status: 400 },
    );
  }

  const { data: result, error } = await supabase.rpc('professional_update_appointment', {
    p_appointment_id: id,
    p_action: isCancel ? 'cancel' : 'reschedule',
    p_start_at: (body.start_at as string) ?? null,
    p_end_at: (body.end_at as string) ?? null,
  });

  if (error) {
    const msg = error.message ?? '';
    if (error.code === '23P01' || msg.includes('ya no está disponible')) {
      return NextResponse.json({ error: 'overlap', message: 'El horario ya no está disponible' }, { status: 409 });
    }
    if (msg.includes('no encontrada')) {
      return NextResponse.json({ error: 'not_found', message: msg }, { status: 404 });
    }
    if (msg.includes('No se puede')) {
      return NextResponse.json({ error: 'invalid_state', message: msg }, { status: 409 });
    }
    console.error('agenda PATCH error', id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ appointment: result });
}
