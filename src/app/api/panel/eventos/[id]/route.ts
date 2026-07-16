import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { Database } from '@/types/database';

type LiveEventUpdate = Database['public']['Tables']['live_events']['Update'];

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

// PATCH /api/panel/eventos/[id] — editar campos o publicar/despublicar.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireProfessionalTenant(supabase);
  if ('error' in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: 'body requerido' }, { status: 400 });

  const allowed = ['title', 'description', 'start_at', 'end_at', 'capacity', 'price_cents', 'published', 'status'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  const { data: updated, error } = await supabase
    .from('live_events')
    .update(updates as unknown as LiveEventUpdate)
    .eq('id', params.id)
    .eq('tenant_id', auth.tenantId)
    .select()
    .single();

  if (error) {
    console.error('panel/eventos PATCH error', params.id, error);
    return NextResponse.json({ error: 'error_interno', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: updated });
}

// DELETE /api/panel/eventos/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const auth = await requireProfessionalTenant(supabase);
  if ('error' in auth) return auth.error;

  const { error } = await supabase
    .from('live_events')
    .delete()
    .eq('id', params.id)
    .eq('tenant_id', auth.tenantId);

  if (error) {
    console.error('panel/eventos DELETE error', params.id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
