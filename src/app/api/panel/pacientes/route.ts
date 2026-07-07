import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/panel/pacientes
// Lista de pacientes del tenant. Cliente authenticated => RLS aísla por tenant.
// active_credits = # de compras de paquete vigentes con saldo (status 'active'
// y sessions_used < sessions_total). Se agrega en el servidor por paciente.
//
// Contrato de respuesta:
// { patients: [{ id, full_name, email, phone, notas_operativas, active_credits }] }
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, full_name, email, phone, notas_operativas')
    .order('full_name', { ascending: true });

  if (error) {
    console.error('panel/pacientes error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  const list = patients ?? [];
  if (list.length === 0) {
    return NextResponse.json({ patients: [] });
  }

  // Créditos vigentes por paciente (una sola consulta, agregada en memoria).
  const ids = list.map((p) => p.id);
  const { data: credits, error: cErr } = await supabase
    .from('patient_credits')
    .select('patient_id, sessions_total, sessions_used, status')
    .in('patient_id', ids)
    .eq('status', 'active');

  if (cErr) {
    console.error('panel/pacientes credits error', cErr);
    // Degradación suave: devolvemos pacientes sin el conteo antes que fallar.
    return NextResponse.json({
      patients: list.map((p) => ({ ...p, active_credits: 0 })),
    });
  }

  const activeByPatient = new Map<string, number>();
  for (const c of credits ?? []) {
    if ((c.sessions_used ?? 0) < (c.sessions_total ?? 0)) {
      activeByPatient.set(c.patient_id, (activeByPatient.get(c.patient_id) ?? 0) + 1);
    }
  }

  return NextResponse.json({
    patients: list.map((p) => ({ ...p, active_credits: activeByPatient.get(p.id) ?? 0 })),
  });
}
