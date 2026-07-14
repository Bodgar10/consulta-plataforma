'use client';

import { Reveal } from '@/components/motion/Reveal';

const points = [
  { title: 'Duración', text: '50 minutos por sesión, a la misma hora cada semana.' },
  { title: 'En línea', text: 'Desde donde estés, con conexión privada y sin necesidad de instalar nada.' },
  { title: 'Confidencial', text: 'Lo que se habla en sesión se queda en sesión. Ningún dato clínico se guarda en el sistema.' },
];

export function AboutSessions() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-16 md:py-24">
      <Reveal>
        <h2 className="section-title text-center mb-4">Sobre las sesiones</h2>
        <p className="muted text-center max-w-xl mx-auto mb-12 md:mb-16">
          Un espacio de escucha continua, sostenido en el tiempo. Así funciona en la práctica.
        </p>
      </Reveal>
      <div className="grid gap-8 md:grid-cols-3">
        {points.map((point, i) => (
          <Reveal key={point.title} delay={Math.min(i * 0.1, 0.2)}>
            <div className="card h-full">
              <h3 className="card-title mb-2">{point.title}</h3>
              <p className="text-body text-sand-700">{point.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
