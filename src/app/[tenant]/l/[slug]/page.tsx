import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { LeadCaptureForm } from '@/components/funnel/LeadCaptureForm';

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
      <section className="landing-hero">
        <h1 className="page-title max-w-2xl">{data.headline}</h1>
        {data.intro_video_url && (
          <div className="mt-6 aspect-video w-full max-w-2xl rounded-[14px] overflow-hidden">
            <iframe src={data.intro_video_url} className="w-full h-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
          </div>
        )}
      </section>

      <section className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {data.body?.map((block, i) => <LandingBlockView key={i} block={block} />)}
      </section>

      <section className="max-w-2xl mx-auto px-4 pb-16">
        {(data.cta_type === 'magnet' || data.cta_type === 'lead_magnet') && (
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
