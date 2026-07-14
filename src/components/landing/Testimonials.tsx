'use client';

import { Reveal } from '@/components/motion/Reveal';

const testimonials = [
  { text: 'Encontrar un espacio fijo cada semana para hablar sin prisa me cambió la forma de entender lo que sentía.', name: 'Paciente de psicoanálisis' },
  { text: 'Agendar y conectarme fue simple desde el primer día. Eso me dejó enfocarme en lo que importaba.', name: 'Paciente de psicoanálisis' },
];

export function Testimonials() {
  return (
    <section className="max-w-3xl mx-auto px-6 py-16 md:py-24">
      <Reveal>
        <h2 className="section-title text-center mb-12 md:mb-16">Voces del proceso</h2>
      </Reveal>
      <div className="grid gap-6 md:grid-cols-2">
        {testimonials.map((t, i) => (
          <Reveal key={i} delay={Math.min(i * 0.12, 0.24)}>
            <blockquote className="card h-full">
              <p className="text-body text-pine-900 italic">&ldquo;{t.text}&rdquo;</p>
              <footer className="muted mt-3">— {t.name}</footer>
            </blockquote>
          </Reveal>
        ))}
      </div>
      <p className="muted text-center mt-8 text-xs">
        Testimonios ilustrativos basados en experiencias comunes de terapia. No corresponden a citas verificadas en la plataforma.
      </p>
    </section>
  );
}
