import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// POST /api/panel/pacientes/[id]/creditos
// Emite un crédito manual (la profesional ya cobró fuera de Stripe). El crédito
// nace 'active'. expires_at lo calcula el RPC desde packages.valid_days.
// Body: { package_id, amount_paid_cents? }
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'falta patient id' }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.package_id) {
    return NextResponse.json({ error: 'package_id requerido' }, { status: 400 });
  }

  const { data: result, error } = await supabase.rpc('professional_issue_credit', {
    p_patient_id: id,
    p_package_id: body.package_id as string,
    p_amount_paid_cents: (body.amount_paid_cents as number) ?? 0,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('Paciente no encontrado') || msg.includes('Paquete no encontrado')) {
      return NextResponse.json({ error: 'not_found', message: msg }, { status: 404 });
    }
    console.error('creditos POST error', id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ credit: result });
}
