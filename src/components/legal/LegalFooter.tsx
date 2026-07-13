/**
 * Footer legal del plano público. Recibe el segmento de tenant para construir
 * los links (las páginas legales viven bajo /[tenant]/...).
 */
export function LegalFooter({ tenantSlug }: { tenantSlug: string }) {
  const year = new Date().getFullYear();
  const base = `/${tenantSlug}`;
  return (
    <footer className="mt-16 border-t-[0.5px] border-sand-200">
      <div className="mx-auto max-w-4xl px-6 py-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <a href={`${base}/privacidad`} className="btn-ghost text-sm">Aviso de privacidad</a>
          <a href={`${base}/terminos`} className="btn-ghost text-sm">Términos y condiciones</a>
          <a href={`${base}/cancelacion`} className="btn-ghost text-sm">Política de cancelación</a>
        </nav>
        <p className="muted">© {year}</p>
      </div>
    </footer>
  );
}
