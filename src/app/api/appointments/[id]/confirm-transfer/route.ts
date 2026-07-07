import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { applyConfirmationEffects } from '@/lib/booking/confirm';

export const dynamic = 'force-dynamic';

// POST /api/appointments/[id]/confirm-transfer
// Confirmación MANUAL de transferencia por la profesional (authenticated, owner
// del tenant). Marca la cita pagada vía el RPC confirm_transfer_payment (mismo
// efecto que el webhook) y dispara los MISMOS efectos idempotentes (sala Daily +
// correo) a través del helper único. La transferencia BRINCA Connect.
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;
  if (!id) {
    return NextResponse.json({ error: 'falta appointment id' }, { status: 400 });
  }

  // Cliente authenticated: el RPC usa auth.uid() + current_user_tenant_ids()
  // para validar ownership y estado. Sin sesión => 401.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const { data: result, error } = await supabase.rpc('confirm_transfer_payment', {
    p_appointment_id: id,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('no encontrada')) {
      return NextResponse.json({ error: 'not_found', message: msg }, { status: 404 });
    }
    if (msg.includes('pendiente de verificación')) {
      return NextResponse.json({ error: 'invalid_state', message: msg }, { status: 409 });
    }
    console.error('confirm-transfer error', id, error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  const transitioned = (result as { transitioned?: boolean } | null)?.transitioned ?? false;

  // Idempotente: ya estaba confirmada => no re-disparar efectos (ni 2do correo).
  if (!transitioned) {
    return NextResponse.json({ status: 'confirmed', appointment_id: id, idempotent: true });
  }

  // Datos para los efectos. Admin para desacoplar de RLS: la autorización ya la
  // impuso el RPC de arriba.
  const admin = createAdminClient();
  const { data: full, error: fErr } = await admin
    .from('appointments')
    .select('start_at, end_at, video_room_url, patient:patients(full_name, email), tenant:tenants(timezone)')
    .eq('id', id)
    .single();

  if (fErr || !full) {
    // La confirmación YA quedó persistida; solo no pudimos cargar datos de efectos.
    console.error('confirm-transfer: sin datos para efectos', id, fErr);
    return NextResponse.json({ status: 'confirmed', appointment_id: id, video_room_url: null });
  }

  const patient = (full as { patient?: { full_name?: string; email?: string } }).patient;
  const tenantTz = (full as { tenant?: { timezone?: string } }).tenant?.timezone;

  const roomUrl = await applyConfirmationEffects(admin, {
    appointmentId: id,
    startAt: full.start_at as string,
    endAt: full.end_at as string,
    videoRoomUrl: full.video_room_url as string | null,
    patientEmail: patient?.email ?? null,
    patientFullName: patient?.full_name ?? null,
    tenantTimezone: tenantTz ?? null,
  });

  return NextResponse.json({ status: 'confirmed', appointment_id: id, video_room_url: roomUrl });
}
