import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/panel/citas/recurrentes/[group_id]/cancelar-futuras
// Cancela todas las instancias FUTURAS (start_at > now) de un grupo recurrente.
// NO toca las pasadas (completed) ni citas fuera del grupo. Cliente authenticated
// => la política appts_pro_all impone que el grupo sea del tenant de la sesión
// (el update solo afecta filas visibles por RLS). Idempotente.
export async function POST(
  _req: NextRequest,
  { params }: { params: { group_id: string } },
) {
  const { group_id } = params;
  if (!group_id) {
    return NextResponse.json({ error: 'falta group_id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('recurrence_group_id', group_id)
    .gt('start_at', nowIso)
    .in('status', ['pending_payment', 'pending_verification', 'confirmed'])
    .select('id');

  if (error) {
    console.error('cancelar-futuras error', group_id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ cancelled: data?.length ?? 0 });
}
