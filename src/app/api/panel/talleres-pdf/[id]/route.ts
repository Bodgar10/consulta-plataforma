import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { Database } from '@/types/database';

type PdfWorkshopUpdate = Database['public']['Tables']['pdf_workshops']['Update'];

export const dynamic = 'force-dynamic';

async function requireProfessionalTenant(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: 'no autenticado' }, { status: 401 }) };

  const { data: context } = await supabase.rpc('current_user_context').maybeSingle();
  if (!context?.is_professional) {
    return { error: NextResponse.json({ error: 'no autorizado' }, { status: 403 }) };
  }

  const { data: tenantIds } = await supabase.rpc('current_user_tenant_ids');
  const tenantId = (tenantIds as string[] | null)?.[0] ?? null;
  if (!tenantId) return { error: NextResponse.json({ error: 'sin tenant' }, { status: 403 }) };

  return { tenantId };
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireProfessionalTenant(supabase);
  if ('error' in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'body requerido' }, { status: 400 });

  const allowed = ['title', 'description', 'price_cents', 'grants_free_session', 'published', 'file_path'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data: updated, error } = await supabase
    .from('pdf_workshops')
    .update(updates as unknown as PdfWorkshopUpdate)
    .eq('id', params.id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single();

  if (error) {
    console.error('panel/talleres-pdf PATCH error', params.id, error);
    return NextResponse.json({ error: 'error_interno', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ workshop: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireProfessionalTenant(supabase);
  if ('error' in auth) return auth.error;

  const { error } = await supabase
    .from('pdf_workshops')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', auth.tenantId);

  if (error) {
    console.error('panel/talleres-pdf DELETE error', params.id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
