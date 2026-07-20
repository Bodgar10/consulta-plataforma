import { createClient } from '@/utils/supabase/server';
import { Reveal } from '@/components/motion/Reveal';

type Workshop = {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  grants_free_session: boolean;
};

function formatPrice(cents: number | null) {
  if (!cents) return 'Gratis';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100);
}

export async function PdfWorkshopsTeaser({
  tenantId,
  tenantSlug,
}: {
  tenantId: string;
  tenantSlug: string;
}) {
  const supabase = await createClient();
  const { data: workshops } = await supabase.rpc('public_get_pdf_workshops', {
    p_tenant_id: tenantId,
  });
  const list = (workshops as Workshop[] | null) ?? [];

  if (list.length === 0) return null;

  return (
    <section className="max-w-4xl mx-auto px-6 py-12 md:py-16">
      <Reveal>
        <h2 className="section-title text-center mb-4">Talleres para descargar</h2>
        <p className="muted text-center max-w-xl mx-auto mb-12">
          Material para leer a tu ritmo, cuando tú quieras.
        </p>
      </Reveal>
      <div className="grid gap-6 md:grid-cols-2">
        {list.map((w, i) => (
          <Reveal key={w.id} delay={Math.min(i * 0.1, 0.2)}>
            <a href={`/${tenantSlug}/taller/${w.id}`} className="card-interactive h-full flex flex-col">
              <h3 className="card-title">{w.title}</h3>
              {w.description && <p className="muted mt-2">{w.description}</p>}
              <p className="text-pine-700 font-medium mt-3 tabular-nums">{formatPrice(w.price_cents)}</p>
              {w.grants_free_session && (
                <p className="muted mt-1">Incluye sesión de terapia gratis</p>
              )}
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
