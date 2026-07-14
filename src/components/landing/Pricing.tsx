import { createClient } from '@/utils/supabase/server';
import { Reveal } from '@/components/motion/Reveal';
import { BookCTA } from './BookCTA';

type PackageRow = {
  id: string;
  name: string;
  sessions_count: number;
  price_cents: number;
  valid_days: number;
};

function formatMXN(cents: number) {
  return (cents / 100).toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  });
}

export async function Pricing({
  tenantId,
  tenantSlug,
  sessionPriceCents,
  acceptsTransfer,
}: {
  tenantId: string;
  tenantSlug: string;
  sessionPriceCents: number | null;
  acceptsTransfer: boolean;
}) {
  const supabase = await createClient();
  const { data: packages } = await supabase.rpc('public_get_packages', {
    p_tenant_id: tenantId,
  });
  const list = (packages ?? []) as PackageRow[];
  const bestPackage = list.reduce<PackageRow | null>(
    (best, pkg) => (!best || pkg.sessions_count > best.sessions_count ? pkg : best),
    null
  );

  return (
    <section className="max-w-4xl mx-auto px-6 py-12 md:py-16">
      <Reveal>
        <h2 className="section-title text-center mb-4">Precio y paquetes</h2>
        {sessionPriceCents != null && (
          <p className="muted text-center max-w-xl mx-auto mb-12 md:mb-16">
            Sesión individual:{' '}
            <span className="text-pine-700 font-medium tabular-nums">
              {formatMXN(sessionPriceCents)}
            </span>
          </p>
        )}
      </Reveal>

      {list.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 mb-10">
          {list.map((pkg, i) => (
            <Reveal key={pkg.id} delay={Math.min(i * 0.1, 0.2)}>
              <div className="card h-full flex flex-col">
                <h3 className="card-title">{pkg.name}</h3>
                <p className="font-display text-[1.75rem] font-medium text-pine-700 mt-2 tabular-nums">
                  {formatMXN(pkg.price_cents)}
                </p>
                <p className="muted mt-1">
                  {pkg.sessions_count} sesiones · vigencia {Math.round(pkg.valid_days / 30)} meses
                </p>
                {bestPackage && pkg.id === bestPackage.id && (
                  <p className="mt-3 text-sm text-pine-600">
                    Llévate {pkg.sessions_count} sesiones por {formatMXN(pkg.price_cents)}
                  </p>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      )}

      <Reveal delay={0.15}>
        <p className="muted text-center mb-8">
          Formas de pago: tarjeta{acceptsTransfer ? ' · transferencia bancaria' : ''}
        </p>
      </Reveal>

      <Reveal delay={0.2}>
        <div className="text-center">
          <BookCTA tenantSlug={tenantSlug} />
        </div>
      </Reveal>
    </section>
  );
}
