'use client';

import { Reveal } from '@/components/motion/Reveal';

const steps = [
  {
    number: '01',
    title: 'Agenda tu primera sesión',
    text: 'Eliges el horario que te acomode desde el calendario disponible, sin llamadas ni esperas.',
  },
  {
    number: '02',
    title: 'Confirmación y acceso',
    text: 'Recibes un correo con la confirmación y el enlace privado a tu sala de sesión.',
  },
  {
    number: '03',
    title: 'Tu espacio, en línea',
    text: 'Te conectas a la hora acordada desde donde estés. La sesión es confidencial y solo entre ustedes dos.',
  },
];

export function HowItWorks() {
  return (
    <section className="max-w-4xl mx-auto px-6 py-12 md:py-16">
      <Reveal>
        <h2 className="section-title text-center mb-12 md:mb-16">Cómo funciona</h2>
      </Reveal>
      <div className="grid gap-10 md:grid-cols-3 md:gap-8">
        {steps.map((step, i) => (
          <Reveal key={step.number} delay={Math.min(i * 0.12, 0.24)}>
            <div className="flex flex-col items-start gap-3">
              <span className="font-display text-[2.25rem] font-medium text-pine-200">
                {step.number}
              </span>
              <h3 className="card-title">{step.title}</h3>
              <p className="text-body text-sand-700">{step.text}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
