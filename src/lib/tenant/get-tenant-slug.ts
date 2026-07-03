import { headers } from "next/headers";

/**
 * Resuelve el slug del tenant soportando los 3 modos del resolvedor trilateral
 * (dominio custom / subdominio / path) montado en el middleware (src/middleware.ts).
 * - Si la ruta trae `params.tenant` (modo path), se usa directo — más rápido, sin
 *   tocar headers.
 * - Si no (modo subdominio o dominio custom), se lee del header `x-tenant-slug`
 *   que dejó el middleware.
 */
export async function getTenantSlug(paramsSlug?: string): Promise<string | null> {
  if (paramsSlug) return paramsSlug;
  const headerList = await headers();
  return headerList.get("x-tenant-slug");
}
