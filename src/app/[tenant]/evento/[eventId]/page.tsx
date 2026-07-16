import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { DateTime } from 'luxon';
import { createClient } from '@/utils/supabase/server';
import { EventRegister } from '@/components/events/EventRegister';

type LiveEventData = {
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug, eventId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .rpc('public_get_tenant_by_slug', { p_slug: tenantSlug })
    .maybeSingle();

  if (!tenant?.id) return {};

  const { data: event } = await supabase.rpc('public_get_live_event', {
    p_tenant_id: tenant.id,
    p_event_id: eventId,
  });

  if (!event) return {};

  const data = event as { title: string };

  return {
    title: `${data.title} · ${tenant.display_name}`,
  };
}

export default async function LiveEventPage({
  params,
}: {
  params: Promise<{ tenant: string; eventId: string }>;
}) {
  const { tenant: tenantSlug, eventId } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .rpc('public_get_tenant_by_slug', { p_slug: tenantSlug })
    .maybeSingle();

  if (!tenant?.id) notFound();

  const { data: event, error } = await supabase.rpc('public_get_live_event', {
    p_tenant_id: tenant.id,
    p_event_id: eventId,
  });

  if (error) console.error('public_get_live_event error:', error);
  if (!event) notFound();

  const data = event as LiveEventData;
  const timeZone = tenant.timezone as string;
  const inicio = DateTime.fromISO(data.start_at, { zone: 'utc' }).setZone(timeZone).setLocale('es');
  const fin = DateTime.fromISO(data.end_at, { zone: 'utc' }).setZone(timeZone).setLocale('es');
  const fecha = `${inicio.toFormat("cccc d 'de' LLLL")}, ${inicio.toFormat('h:mm a')}–${fin.toFormat('h:mm a')}`;

  const seatsLeft = Math.max(data.capacity - data.seats_taken, 0);
  const isFull = seatsLeft === 0;

  return (
    <main className="min-h-screen bg-cream-50 flex justify-center px-4 py-12">
      <div className="card max-w-lg w-full">
        <h1 className="page-title">{data.title}</h1>
        {data.description && <p className="text-body text-pine-900 mt-3">{data.description}</p>}

        <div className="event-meta mt-5 space-y-2 tabular-nums">
          <p className="text-body text-pine-700">{fecha}</p>
          <p className="section-title text-clay-600">{formatPrice(data.price_cents)}</p>
          <p className="muted">
            {isFull ? 'Cupo lleno' : `${seatsLeft} lugar${seatsLeft === 1 ? '' : 'es'} disponible${seatsLeft === 1 ? '' : 's'}`}
          </p>
        </div>

        <div className="event-capacity-bar mt-3">
          <div className="h-1.5 rounded-full bg-sand-200 overflow-hidden" role="progressbar" aria-valuenow={data.seats_taken} aria-valuemin={0} aria-valuemax={data.capacity}>
            <div className="h-full bg-pine-600" style={{ width: `${Math.min((data.seats_taken / data.capacity) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="mt-6">
          <EventRegister
            tenantId={tenant.id}
            tenantSlug={tenantSlug}
            eventId={data.id}
            eventTitle={data.title}
            eventDate={fecha}
            priceCents={data.price_cents}
            isFull={isFull}
          />
        </div>
      </div>
    </main>
  );
}
