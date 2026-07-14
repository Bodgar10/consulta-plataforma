import { DateTime } from 'luxon';
import { createClient } from '@/utils/supabase/server';
import { Reveal } from '@/components/motion/Reveal';

type UpcomingEvent = {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  price_cents: number | null;
  capacity: number;
  seats_taken: number;
};

function formatPrice(cents: number | null) {
  if (!cents) return 'Gratis';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(cents / 100);
}

export async function EventsTeaser({
  tenantId,
  tenantSlug,
  timezone,
}: {
  tenantId: string;
  tenantSlug: string;
  timezone: string;
}) {
  const supabase = await createClient();
  const { data: events } = await supabase.rpc('public_get_upcoming_events', {
    p_tenant_id: tenantId,
  });
  const list = (events ?? []) as UpcomingEvent[];

  return (
    <section className="max-w-4xl mx-auto px-6 py-12 md:py-16">
      <Reveal>
        <h2 className="section-title text-center mb-4">Eventos en vivo</h2>
        <p className="muted text-center max-w-xl mx-auto mb-12 md:mb-16">
          {list.length > 0
            ? 'Espacios grupales en vivo, con cupo limitado.'
            : 'Próximamente talleres grupales en vivo. Déjanos tu correo y te avisamos en cuanto haya fecha.'}
        </p>
      </Reveal>

      {list.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {list.map((event, i) => {
            const start = DateTime.fromISO(event.start_at, { zone: 'utc' }).setZone(timezone).setLocale('es');
            const end = DateTime.fromISO(event.end_at, { zone: 'utc' }).setZone(timezone).setLocale('es');
            const seatsLeft = Math.max(event.capacity - event.seats_taken, 0);
            return (
              <Reveal key={event.id} delay={Math.min(i * 0.1, 0.2)}>
                <a href={`/${tenantSlug}/evento/${event.id}`} className="card-interactive h-full flex flex-col">
                  <h3 className="card-title">{event.title}</h3>
                  <p className="muted mt-2">
                    {start.toFormat("cccc d 'de' LLLL")} · {start.toFormat('h:mm a')}–{end.toFormat('h:mm a')}
                  </p>
                  <p className="text-pine-700 font-medium mt-2 tabular-nums">{formatPrice(event.price_cents)}</p>
                  <p className="muted mt-1">
                    {seatsLeft === 0 ? 'Cupo lleno' : `${seatsLeft} lugar${seatsLeft === 1 ? '' : 'es'} disponible${seatsLeft === 1 ? '' : 's'}`}
                  </p>
                  {seatsLeft > 0 && (
                    <p className="text-pine-600 text-base font-semibold mt-3">
                      Reservar mi lugar →
                    </p>
                  )}
                </a>
              </Reveal>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
