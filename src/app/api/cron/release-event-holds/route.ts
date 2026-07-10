import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STALE_MINUTES = 30; // ventana de abandono de checkout

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'cron no configurado' }, { status: 500 });
  }
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_MINUTES * 60_000).toISOString();
  const supabase = createAdminClient();

  // Borra solo asientos en hold sin pagar y vencidos. Nunca toca 'paid' ni 'free'.
  const { data, error } = await supabase
    .from('live_event_registrations')
    .delete()
    .eq('payment_status', 'pending_payment')  // solo hold de pago
    .is('stripe_payment_intent', null)        // sin PI (no pagó)
    .lt('created_at', cutoff)                  // vencido
    .select('id');

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, released: data?.length ?? 0 });
}
