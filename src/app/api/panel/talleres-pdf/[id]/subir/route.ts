import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';

// Sube el archivo PDF al bucket privado y guarda la ruta en pdf_workshops.
// Se usa el cliente admin SOLO para el upload (evita RLS de Storage para
// escribir en la ruta correcta); la autorización real ya se validó arriba
// con current_user_context() + verificar que el taller sea de este tenant.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const { data: context } = await supabase.rpc('current_user_context').maybeSingle();
  if (!context?.is_professional) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  }

  const { data: tenantIds } = await supabase.rpc('current_user_tenant_ids');
  const tenantId = (tenantIds as string[] | null)?.[0] ?? null;
  if (!tenantId) return NextResponse.json({ error: 'sin tenant' }, { status: 403 });

  const { data: workshop } = await supabase
    .from('pdf_workshops')
    .select('id')
    .eq('id', params.id)
    .eq('tenant_id', tenantId)
    .single();

  if (!workshop) return NextResponse.json({ error: 'taller no encontrado' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'falta el archivo' }, { status: 400 });
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'solo se aceptan archivos PDF' }, { status: 400 });
  }

  const admin = createAdminClient();
  const filePath = `${tenantId}/${params.id}.pdf`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from('pdf-workshops')
    .upload(filePath, buffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    console.error('subir taller: error de storage', uploadError);
    return NextResponse.json({ error: 'error_subiendo_archivo' }, { status: 500 });
  }

  await supabase.from('pdf_workshops').update({ file_path: filePath }).eq('id', params.id);

  return NextResponse.json({ ok: true, file_path: filePath });
}
