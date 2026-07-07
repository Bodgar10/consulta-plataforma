import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/panel/por-verificar
// Bandeja de cobros/transferencias pendientes de confirmar: citas en
// pending_verification. Cliente authenticated => RLS aísla por tenant.
// La profesional confirma cada una vía POST /api/appointments/[id]/confirm-transfer.
//
// Contrato de respuesta:
// { pending: [{ id, start_at, end_at, amount_paid_cents, created_at,
//               patient: { full_name, email } }] }
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('appointments')
    .select('id, start_at, end_at, amount_paid_cents, created_at, patient:patients(full_name, email)')
    .eq('status', 'pending_verification')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('panel/por-verificar error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ pending: data ?? [] });
}
