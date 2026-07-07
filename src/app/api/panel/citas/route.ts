import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { applyConfirmationEffects } from '@/lib/booking/confirm';

export const dynamic = 'force-dynamic';

// POST /api/panel/citas
// Cita manual: la profesional agenda directo (sin Stripe/hold/cron). Nace
// 'confirmed' vía professional_create_appointment (G1) y dispara los MISMOS
// efectos que los otros caminos (sala Daily + correo) con applyConfirmationEffects.
//
// Body: {
//   start_at, end_at (ISO UTC),
//   patient_id?          (paciente existente)  -- o bien:
//   full_name?, email?, phone?  (paciente nuevo: upsert por tenant+email)
//   payment_mode?        ('single'|'credit'|'transfer'|'external'; default 'external')
// }
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'no autenticado' }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || !body.start_at || !body.end_at) {
    return NextResponse.json({ error: 'start_at y end_at requeridos' }, { status: 400 });
  }
  if (!body.patient_id && (!body.full_name || !body.email)) {
    return NextResponse.json(
      { error: 'da patient_id o (full_name y email)' },
      { status: 400 },
    );
  }

  const { data: result, error } = await supabase.rpc('professional_create_appointment', {
    p_start_at: body.start_at as string,
    p_end_at: body.end_at as string,
    p_patient_id: (body.patient_id as string) ?? null,
    p_full_name: (body.full_name as string) ?? null,
    p_email: (body.email as string) ?? null,
    p_phone: (body.phone as string) ?? null,
    p_payment_mode: (body.payment_mode as string) ?? 'external',
    // La fn acepta null (default); el cast satisface el tipo generado (arg
    // opcional string) preservando el null en runtime -> SQL default.
    p_recurrence_group_id: null as unknown as string,
  });

  if (error) {
    const msg = error.message ?? '';
    if (error.code === '23P01' || msg.includes('ya no está disponible')) {
      return NextResponse.json({ error: 'overlap', message: 'El horario ya no está disponible' }, { status: 409 });
    }
    if (msg.includes('Paciente no encontrado') || msg.includes('Falta paciente')) {
      return NextResponse.json({ error: 'patient_invalid', message: msg }, { status: 422 });
    }
    console.error('panel/citas error', error);
    return NextResponse.json({ error: 'error_interno' }, { status: 500 });
  }

  const r = result as { appointment_id: string; transitioned?: boolean };

  // Datos para efectos (admin: la autorización ya la impuso el RPC definer).
  const admin = createAdminClient();
  const { data: full } = await admin
    .from('appointments')
    .select('start_at, end_at, video_room_url, patient:patients(full_name, email), tenant:tenants(timezone)')
    .eq('id', r.appointment_id)
    .single();

  let roomUrl: string | null = null;
  if (full && r.transitioned) {
    const patient = (full as { patient?: { full_name?: string; email?: string } }).patient;
    const tenantTz = (full as { tenant?: { timezone?: string } }).tenant?.timezone;
    roomUrl = await applyConfirmationEffects(admin, {
      appointmentId: r.appointment_id,
      startAt: full.start_at as string,
      endAt: full.end_at as string,
      videoRoomUrl: full.video_room_url as string | null,
      patientEmail: patient?.email ?? null,
      patientFullName: patient?.full_name ?? null,
      tenantTimezone: tenantTz ?? null,
    });
  }

  return NextResponse.json({ appointment_id: r.appointment_id, video_room_url: roomUrl });
}
