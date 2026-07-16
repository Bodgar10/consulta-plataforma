import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/panel/eventos — lista TODOS los eventos del tenant (publicados o no,
// pasados o futuros). A diferencia de public_get_upcoming_events (que solo
// muestra publicados y futuros para el público), aquí la profesional ve todo.
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { data: context } = await supabase.rpc('current_user_context').maybeSingle();
  if (!context?.is_professional) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  }

  const { data: tenantId } = await supabase
    .rpc('current_user_tenant_ids')
    .then((res) => ({ data: (res.data as string[] | null)?.[0] ?? null }));

  if (!tenantId) {
    return NextResponse.json({ error: 'sin tenant' }, { status: 403 });
  }

  const { data: events, error } = await supabase
    .from('live_events')
    .select('id, title, description, start_at, end_at, capacity, price_cents, status, published, created_at, video_room_url')
    .eq('tenant_id', tenantId)
    .order('start_at', { ascending: false });

  if (error) {
    console.error('panel/eventos GET error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ events: events ?? [] });
}

// POST /api/panel/eventos — crea un evento nuevo.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { data: context } = await supabase.rpc('current_user_context').maybeSingle();
  if (!context?.is_professional) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  }

  const { data: tenantId } = await supabase
    .rpc('current_user_tenant_ids')
    .then((res) => ({ data: (res.data as string[] | null)?.[0] ?? null }));

  if (!tenantId) {
    return NextResponse.json({ error: 'sin tenant' }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.title || !body.start_at || !body.end_at) {
    return NextResponse.json({ error: 'faltan campos requeridos' }, { status: 400 });
  }

  const { data: created, error } = await supabase
    .from('live_events')
    .insert({
      tenant_id: tenantId,
      title: body.title as string,
      description: (body.description as string) || null,
      start_at: body.start_at as string,
      end_at: body.end_at as string,
      capacity: (body.capacity as number) ?? 100,
      price_cents: body.price_cents === null || body.price_cents === undefined ? null : (body.price_cents as number),
      status: 'scheduled',
      published: (body.published as boolean) ?? false,
    })
    .select()
    .single();

  if (error) {
    console.error('panel/eventos POST error', error);
    return NextResponse.json({ error: 'error_interno', message: error.message }, { status: 500 });
  }

  return NextResponse.json({ event: created });
}
