import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// PATCH /api/panel/pacientes/[id]
// Guarda notas_operativas de un paciente del tenant. Cliente authenticated =>
// la RLS (lente profesional) impone que el paciente pertenezca al tenant; el
// CHECK notas_operativas_max_len (migración 012) rechaza texto > 2000 chars.
// notas_operativas es NIVEL 2 (operativo), NUNCA clínico: la etiqueta/aviso es UI.
//
// Body: { notas_operativas: string | null }
// Respuesta: { patient: { id, notas_operativas } }
export async function PATCH(
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

  const body = (await req.json().catch(() => null)) as { notas_operativas?: unknown } | null;
  if (!body || !('notas_operativas' in body)) {
    return NextResponse.json({ error: 'notas_operativas requerido' }, { status: 400 });
  }
  const notas = body.notas_operativas;
  if (notas !== null && typeof notas !== 'string') {
    return NextResponse.json({ error: 'notas_operativas debe ser string o null' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('patients')
    .update({ notas_operativas: notas })
    .eq('id', id)
    .select('id, notas_operativas')
    .maybeSingle();

  if (error) {
    // 23514 = violación del CHECK de longitud (nota demasiado larga).
    if ((error as { code?: string }).code === '23514') {
      return NextResponse.json(
        { error: 'nota_demasiado_larga', message: 'La nota operativa excede el máximo permitido.' },
        { status: 422 },
      );
    }
    console.error('panel/pacientes PATCH error', id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  // maybeSingle() => null si la RLS ocultó la fila (paciente de otro tenant).
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ patient: data });
}
