import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import type { Database } from '@/types/database';

type RuleUpdate = Database['public']['Tables']['availability_rules']['Update'];
type BlockUpdate = Database['public']['Tables']['availability_blocks']['Update'];

export const dynamic = 'force-dynamic';

// CRUD de disponibilidad del tenant: availability_rules + availability_blocks.
// Cliente authenticated => la RLS aísla e impone ownership en lectura y escritura.
//
// GET    -> { rules: [...], blocks: [...] }
// POST   -> body { kind: 'rule'|'block', ...campos }  crea y devuelve la fila
// PATCH  -> body { kind, id, ...campos }              edita y devuelve la fila
// DELETE -> ?kind=rule|block&id=UUID                  borra

async function requireUserAndTenant() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, tenantId: null as string | null };

  // Tenant del profesional resuelto en servidor (no se confía en el cliente).
  const { data: tid } = await supabase.rpc('current_user_tenant_ids');
  const tenantId = Array.isArray(tid) ? (tid[0] as string | undefined) ?? null : null;
  return { supabase, tenantId };
}

export async function GET() {
  const { supabase, tenantId } = await requireUserAndTenant();
  if (!tenantId) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const [{ data: rules, error: rErr }, { data: blocks, error: bErr }] = await Promise.all([
    supabase
      .from('availability_rules')
      .select('id, weekday, start_time, end_time, slot_minutes, buffer_minutes')
      .order('weekday', { ascending: true }),
    supabase
      .from('availability_blocks')
      .select('id, start_at, end_at, reason')
      .order('start_at', { ascending: true }),
  ]);

  if (rErr || bErr) {
    console.error('panel/disponibilidad GET error', rErr, bErr);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ rules: rules ?? [], blocks: blocks ?? [] });
}

export async function POST(req: NextRequest) {
  const { supabase, tenantId } = await requireUserAndTenant();
  if (!tenantId) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || (body.kind !== 'rule' && body.kind !== 'block')) {
    return NextResponse.json({ error: "kind debe ser 'rule' o 'block'" }, { status: 400 });
  }

  if (body.kind === 'rule') {
    const { data, error } = await supabase
      .from('availability_rules')
      .insert({
        tenant_id: tenantId,
        weekday: body.weekday as number,
        start_time: body.start_time as string,
        end_time: body.end_time as string,
        slot_minutes: (body.slot_minutes as number) ?? 50,
        buffer_minutes: (body.buffer_minutes as number) ?? 10,
      })
      .select('id, weekday, start_time, end_time, slot_minutes, buffer_minutes')
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ rule: data });
  }

  const { data, error } = await supabase
    .from('availability_blocks')
    .insert({
      tenant_id: tenantId,
      start_at: body.start_at as string,
      end_at: body.end_at as string,
      reason: (body.reason as string) ?? null,
    })
    .select('id, start_at, end_at, reason')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ block: data });
}

export async function PATCH(req: NextRequest) {
  const { supabase, tenantId } = await requireUserAndTenant();
  if (!tenantId) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.id || (body.kind !== 'rule' && body.kind !== 'block')) {
    return NextResponse.json({ error: 'kind e id requeridos' }, { status: 400 });
  }
  const id = body.id as string;

  if (body.kind === 'rule') {
    const patch: Record<string, unknown> = {};
    for (const k of ['weekday', 'start_time', 'end_time', 'slot_minutes', 'buffer_minutes']) {
      if (k in body) patch[k] = body[k];
    }
    const { data, error } = await supabase
      .from('availability_rules')
      .update(patch as unknown as RuleUpdate)
      .eq('id', id)
      .select('id, weekday, start_time, end_time, slot_minutes, buffer_minutes')
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 422 });
    if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ rule: data });
  }

  const patch: Record<string, unknown> = {};
  for (const k of ['start_at', 'end_at', 'reason']) {
    if (k in body) patch[k] = body[k];
  }
  const { data, error } = await supabase
    .from('availability_blocks')
    .update(patch as unknown as BlockUpdate)
    .eq('id', id)
    .select('id, start_at, end_at, reason')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ block: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, tenantId } = await requireUserAndTenant();
  if (!tenantId) return NextResponse.json({ error: 'no autenticado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get('kind');
  const id = searchParams.get('id');
  if ((kind !== 'rule' && kind !== 'block') || !id) {
    return NextResponse.json({ error: 'kind (rule|block) e id requeridos' }, { status: 400 });
  }

  const table = kind === 'rule' ? 'availability_rules' : 'availability_blocks';
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 422 });
  return NextResponse.json({ ok: true });
}
