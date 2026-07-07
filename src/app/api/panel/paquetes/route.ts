import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { Database } from '@/types/database';

type PackageUpdate = Database['public']['Tables']['packages']['Update'];

export const dynamic = 'force-dynamic';

async function requireTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, tenantId: null as string | null };
  const { data: tid } = await supabase.rpc('current_user_tenant_ids');
  const tenantId = Array.isArray(tid) ? ((tid[0] as string | undefined) ?? null) : null;
  return { supabase, tenantId };
}

// GET /api/panel/paquetes -> { packages: [...] }
export async function GET() {
  const { supabase, tenantId } = await requireTenant();
  if (!tenantId) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const { data, error } = await supabase
    .from('packages')
    .select('id, name, sessions_count, price_cents, valid_days, active')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('panel/paquetes GET error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }
  return NextResponse.json({ packages: data ?? [] });
}

// POST /api/panel/paquetes -> crea. Body { name, sessions_count, price_cents, valid_days? }
export async function POST(req: NextRequest) {
  const { supabase, tenantId } = await requireTenant();
  if (!tenantId) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.name || !body.sessions_count || body.price_cents === undefined) {
    return NextResponse.json(
      { error: 'name, sessions_count y price_cents requeridos' },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from('packages')
    .insert({
      tenant_id: tenantId,
      name: body.name as string,
      sessions_count: body.sessions_count as number,
      price_cents: body.price_cents as number,
      valid_days: (body.valid_days as number) ?? 180,
    })
    .select('id, name, sessions_count, price_cents, valid_days, active')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ package: data });
}

// PATCH /api/panel/paquetes -> edita/desactiva. Body { id, ...campos }
export async function PATCH(req: NextRequest) {
  const { supabase, tenantId } = await requireTenant();
  if (!tenantId) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.id) {
    return NextResponse.json({ error: 'id requerido' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  for (const k of ['name', 'sessions_count', 'price_cents', 'valid_days', 'active']) {
    if (k in body) patch[k] = body[k];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'nada que actualizar' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('packages')
    .update(patch as unknown as PackageUpdate)
    .eq('id', body.id as string)
    .select('id, name, sessions_count, price_cents, valid_days, active')
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ package: data });
}
