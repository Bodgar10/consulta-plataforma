import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createClient } from '@/utils/supabase/server';
import { LeadCaptureForm } from '@/components/funnel/LeadCaptureForm';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { AboutSessions } from '@/components/landing/AboutSessions';
import { Pricing } from '@/components/landing/Pricing';
import { Testimonials } from '@/components/landing/Testimonials';
import { EventsTeaser } from '@/components/landing/EventsTeaser';
import { BookCTA } from '@/components/landing/BookCTA';
import { Reveal } from '@/components/motion/Reveal';

type LandingBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'image'; url: string; alt?: string }
  | { type: 'video'; url: string }
  | { type: 'quote'; text: string; author?: string }
  | { type: 'list'; items: string[] };

type LandingData = {
  id: string;
  theme: string | null;
  headline: string;
  intro_video_url: string | null;
  body: LandingBlock[] | null;
  cta_type: 'lead_magnet' | 'agendar' | string;
  lead_magnet: { id: string; title: string; description: string | null; file_url: string } | null;
};

function LandingBlockView({ block }: { block: LandingBlock }) {
  switch (block.type) {
    case 'paragraph':
      return <p className="landing-block text-body text-pine-900">{block.text}</p>;
    case 'image':
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.url} alt={block.alt ?? ''} className="landing-block w-full rounded-[14px]" />;
    case 'video':
      return (
        <div className="landing-block aspect-video w-full rounded-[14px] overflow-hidden">
          <iframe src={block.url} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
        </div>
      );
    case 'quote':
      return (
        <blockquote className="landing-block border-l-2 border-pine-400 pl-4 italic text-pine-700">
          {block.text}
          {block.author && <footer className="muted mt-1">— {block.author}</footer>}
        </blockquote>
      );
    case 'list':
      return (
        <ul className="landing-block list-disc pl-5 text-body text-pine-900 space-y-1.5">
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );
    default:
      return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug, slug } = await params;
  const supabase = await createClient();

  const { data: tenant } = await supabase
    .rpc('public_get_tenant_by_slug', { p_slug: tenantSlug })
    .maybeSingle();

  if (!tenant?.id) return {};

  const { data: landing } = await supabase.rpc('public_get_landing', {
    p_tenant_id: tenant.id,
    p_slug: slug,
  });

  if (!landing) return {};

  const data = landing as { headline: string };

  return {
    title: `${data.headline} · ${tenant.display_name}`,
  };
}

export default async function LandingSlugPage({
  params,
}: {
  params: Promise<{ tenant: string; slug: string }>;
}) {
  const { tenant: tenantSlug, slug } = await params;
  const supabase = await createClient();

  // public_get_tenant_by_slug es RETURNS TABLE → .maybeSingle()
  const { data: tenant } = await supabase
    .rpc('public_get_tenant_by_slug', { p_slug: tenantSlug })
    .maybeSingle();

  if (!tenant?.id) notFound();

  const paymentSettings = (tenant.payment_settings as unknown as Record<string, unknown>) ?? {};
  const sessionPriceCents =
    typeof paymentSettings.session_price_cents === 'number' ? paymentSettings.session_price_cents : null;
  const acceptsTransfer = Boolean(paymentSettings.accepts_transfer);

  // public_get_landing es RETURNS jsonb (escalar) → SIN .maybeSingle()
  const { data: landing, error } = await supabase.rpc('public_get_landing', {
    p_tenant_id: tenant.id,
    p_slug: slug,
  });

  if (error) console.error('public_get_landing error:', error);
  if (!landing) notFound();

  const data = landing as LandingData;

  return (
    <main className="min-h-screen bg-cream-50">
      <section className="px-6 pt-24 pb-16 md:pt-32 md:pb-20 flex flex-col items-center text-center">
        <p className="hero-fade-up text-sm font-medium tracking-wide text-pine-600 mb-5">
          Yolanda Miranda · Psicoanálisis
        </p>
        <h1 className="hero-fade-up hero-fade-up-delay-1 font-display font-medium text-pine-700 text-[2rem] md:text-[2.75rem] leading-[1.15] max-w-3xl">
          {data.headline}
        </h1>
        <div className="hero-fade-up hero-fade-up-delay-2 mt-10 w-full max-w-2xl">
          {data.intro_video_url ? (
            <div className="aspect-video w-full rounded-[14px] overflow-hidden shadow-[0_12px_40px_-12px_rgba(31,51,46,0.18)] ring-1 ring-sand-200">
              <iframe
                src={data.intro_video_url}
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video w-full rounded-[14px] bg-pine-50 ring-1 ring-sand-200 shadow-[0_12px_40px_-12px_rgba(31,51,46,0.18)] flex flex-col items-center justify-center gap-3">
              <span className="flex items-center justify-center w-14 h-14 rounded-full bg-cream-0 ring-1 ring-sand-200">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-pine-600 translate-x-[1px]">
                  <path d="M8 5v14l11-7L8 5z" fill="currentColor" />
                </svg>
              </span>
              <span className="muted">Un mensaje breve de Yolanda</span>
            </div>
          )}
        </div>
      </section>

      <div className="flex justify-center px-6 -mt-4 mb-4">
        <BookCTA tenantSlug={tenantSlug} />
      </div>

      <HowItWorks />
      <AboutSessions />
      <Pricing
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        sessionPriceCents={sessionPriceCents}
        acceptsTransfer={acceptsTransfer}
      />
      <EventsTeaser
        tenantId={tenant.id}
        tenantSlug={tenantSlug}
        timezone={tenant.timezone as string}
      />
      <Testimonials />

      <section className="max-w-2xl mx-auto px-6 py-12 space-y-6">
        {data.body?.map((block, i) => (
          <Reveal key={i} delay={Math.min(i * 0.08, 0.32)}>
            <LandingBlockView block={block} />
          </Reveal>
        ))}
      </section>

      <section className="max-w-2xl mx-auto px-4 pb-16">
        {(data.cta_type === 'magnet' || data.cta_type === 'lead_magnet') && (
          <Reveal>
            <p className="section-title text-center mb-6">
              ¿Quieres dar el primer paso?
            </p>
            <LeadCaptureForm
            tenantId={tenant.id}
            tenantSlug={tenantSlug}
            landingSlug={slug}
            leadMagnetPreview={
              data.lead_magnet
                ? { title: data.lead_magnet.title, description: data.lead_magnet.description }
                : null
            }
          />
          </Reveal>
        )}
        {(data.cta_type === 'book' || data.cta_type === 'agendar') && (
          <a href={`/${tenantSlug}/agendar`} className="btn-primary w-full">
            Agendar una sesión
          </a>
        )}
      </section>
    </main>
  );
}
