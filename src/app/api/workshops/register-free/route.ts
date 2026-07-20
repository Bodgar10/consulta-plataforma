import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { createSignedDownloadUrl } from '@/lib/storage/workshop-files';
import { sendWorkshopConfirmation } from '@/lib/email/workshop-confirmation';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let tenantId = '', workshopId = '', email = '', name = '';
  try {
    const b = await req.json();
    tenantId = String(b?.tenant_id ?? '');
    workshopId = String(b?.workshop_id ?? '');
    email = String(b?.email ?? '').trim().toLowerCase();
    name = String(b?.name ?? '').trim();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }
  if (!tenantId || !workshopId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: downloadId, error: regErr } = await supabase.rpc('public_register_free_download', {
    p_tenant_id: tenantId,
    p_workshop_id: workshopId,
    p_email: email,
    p_name: name,
  });

  if (regErr) {
    return NextResponse.json({ error: 'register_failed', message: regErr.message }, { status: 400 });
  }

  const { data: workshop } = await supabase
    .from('pdf_workshops')
    .select('title, file_path')
    .eq('id', workshopId)
    .single();

  let downloadUrl: string | null = null;
  if (workshop?.file_path) {
    downloadUrl = await createSignedDownloadUrl(workshop.file_path);
    if (downloadUrl) {
      await sendWorkshopConfirmation({
        email,
        name,
        workshopTitle: workshop.title,
        downloadUrl,
        freeSessionUrl: null,
      });
    }
  }

  return NextResponse.json({ status: 'registered', download_id: downloadId, download_url: downloadUrl });
}
