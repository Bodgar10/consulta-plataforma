import { createAdminClient } from '@/utils/supabase/admin';

const BUCKET = 'pdf-workshops';
const DEFAULT_EXPIRES_SECONDS = 60 * 60 * 24 * 7; // 7 días

/**
 * Genera un link de descarga firmado y temporal para un PDF de taller.
 * Usa el cliente admin (service role) — evade RLS de Storage a propósito,
 * ya que la autorización real ya se validó antes de llamar esto (pago
 * confirmado o registro gratis ya registrado en pdf_workshop_downloads).
 */
export async function createSignedDownloadUrl(
  filePath: string,
  expiresInSeconds: number = DEFAULT_EXPIRES_SECONDS,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, expiresInSeconds);

  if (error) {
    console.error('workshop-files: error generando link firmado', filePath, error);
    return null;
  }
  return data?.signedUrl ?? null;
}
