'use client';

import { useRef, useState } from 'react';
import { Reveal } from '@/components/motion/Reveal';

type TikTokVideo = { id: string; caption?: string };

export function TikTokCarousel({
  videos,
  followUrl,
}: {
  videos: TikTokVideo[];
  followUrl: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  if (!videos || videos.length === 0) return null;

  function scrollToIndex(index: number) {
    const container = scrollRef.current;
    if (!container) return;
    const card = container.children[index] as HTMLElement | undefined;
    if (card) {
      container.scrollTo({ left: card.offsetLeft - container.offsetLeft, behavior: 'smooth' });
    }
  }

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;
    const cards = Array.from(container.children) as HTMLElement[];
    let closest = 0;
    let minDist = Infinity;
    cards.forEach((card, i) => {
      const dist = Math.abs(card.offsetLeft - container.scrollLeft);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    });
    setActiveIndex(closest);
  }

  return (
    <section className="max-w-4xl mx-auto px-6 py-12 md:py-16">
      <Reveal>
        <p className="text-sm font-medium tracking-wide text-pine-600 text-center mb-3">
          Algo de mis redes
        </p>
        <div className="flex justify-center mb-8">
          <a href={followUrl} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Sígueme en TikTok
          </a>
        </div>
      </Reveal>

      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 overflow-x-auto motion-safe:scroll-smooth motion-reduce:scroll-auto snap-x snap-mandatory pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {videos.map((video) => (
            <div key={video.id} className="snap-center shrink-0 w-[75%] sm:w-[45%] md:w-[32%]">
              <div className="aspect-[9/16] w-full rounded-[14px] overflow-hidden ring-1 ring-sand-200 bg-cream-0">
                <iframe
                  src={`https://www.tiktok.com/player/v1/${video.id}`}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              {video.caption && <p className="muted mt-2 text-center">{video.caption}</p>}
            </div>
          ))}
        </div>

        {videos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => scrollToIndex(Math.max(activeIndex - 1, 0))}
              aria-label="Anterior"
              className="hidden md:flex absolute left-[-1.5rem] top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-cream-0 border-[0.5px] border-sand-300 text-pine-700 hover:border-pine-400 transition-colors"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(Math.min(activeIndex + 1, videos.length - 1))}
              aria-label="Siguiente"
              className="hidden md:flex absolute right-[-1.5rem] top-1/2 -translate-y-1/2 items-center justify-center w-9 h-9 rounded-full bg-cream-0 border-[0.5px] border-sand-300 text-pine-700 hover:border-pine-400 transition-colors"
            >
              ›
            </button>
          </>
        )}
      </div>

      {videos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {videos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollToIndex(i)}
              aria-label={`Ir al video ${i + 1}`}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === activeIndex ? 'bg-pine-600' : 'bg-sand-300'}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
