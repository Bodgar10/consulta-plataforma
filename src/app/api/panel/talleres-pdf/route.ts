import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

export async function GET() {
  const supabase = await createClient();
  const auth = await requireProfessionalTenant(supabase);
  if ('error' in auth) return auth.error;

  const { data: workshops, error } = await supabase
    .from('pdf_workshops')
    .select('id, title, description, price_cents, file_path, grants_free_session, published, created_at')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('panel/talleres-pdf GET error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ workshops: workshops ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const auth = await requireProfessionalTenant(supabase);
  if ('error' in auth) return auth.error;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.title) {
    return NextResponse.json({ error: 'falta el título' }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from('pdf_workshops')
    .insert({
      tenant_id: auth.tenantId,
      title: body.title as string,
      description: (body.description as string) || null,
      price_cents: body.price_cents === null || body.price_cents === undefined ? null : (body.price_cents as number),
      grants_free_session: (body.grants_free_session as boolean) ?? false,
      published: false,
    })
    .select()
    .single();

  if (error) {
    console.error('panel/talleres-pdf POST error', error);
    return NextResponse.json({ error: 'error_interno', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ workshop: created });
}
