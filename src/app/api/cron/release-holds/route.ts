import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// GET /api/cron/release-holds
// Libera (cancela) holds de AUTOSERVICIO vencidos: citas creadas por el paciente
// que quedaron en pending_payment / pending_verification, con hold_expires_at ya
// pasado y sin pago liquidado (stripe_payment_intent NULL).
//
// JAMÁS toca lo que crea la profesional: doble candado ->
//   created_by = 'patient'  AND  hold_expires_at IS NOT NULL.
// Las citas manuales nacen con hold_expires_at NULL, así que quedan fuera.
//
// Idempotente: re-correr no hace nada extra (solo captura holds que siguen
// vencidos y sin pagar; una cita ya cancelada/confirmada no re-entra al filtro).
// Protegido con CRON_SECRET (header Authorization: Bearer <secret>, que es como
// Vercel Cron manda el secreto).
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('release-holds: falta CRON_SECRET');
    return NextResponse.json({ error: 'cron no configurado' }, { status: 500 });
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'cancelled' })
    .eq('created_by', 'patient')
    .not('hold_expires_at', 'is', null)
    .lt('hold_expires_at', nowIso)
    .in('status', ['pending_payment', 'pending_verification'])
    .is('stripe_payment_intent', null)
    .select('id');

  if (error) {
    console.error('release-holds: error liberando', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  const released = data?.length ?? 0;
  return NextResponse.json({ ok: true, released });
}
