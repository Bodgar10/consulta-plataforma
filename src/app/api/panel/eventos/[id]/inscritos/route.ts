import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { data: context } = await supabase.rpc('current_user_context').maybeSingle();
  if (!context?.is_professional) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 403 });
  }

  const { data: tenantIds } = await supabase.rpc('current_user_tenant_ids');
  const tenantId = (tenantIds as string[] | null)?.[0] ?? null;
  if (!tenantId) {
    return NextResponse.json({ error: 'sin tenant' }, { status: 403 });
  }

  const { data: registrations, error } = await supabase
    .from('live_event_registrations')
    .select('id, email, name, payment_status, created_at')
    .eq('live_event_id', params.id)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('panel/eventos inscritos GET error', params.id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  return NextResponse.json({ registrations: registrations ?? [] });
}
