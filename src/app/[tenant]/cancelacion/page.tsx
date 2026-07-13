export const metadata = {
  title: 'Política de cancelación',
};

export default function CancelacionPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="page-title mb-2">Política de cancelación</h1>
      <p className="muted mb-8">Cómo funcionan las cancelaciones y reprogramaciones</p>

      <section className="space-y-6 text-body text-pine-900 leading-relaxed">
        <div>
          <h2 className="section-title mb-2">Cancelación con más de 24 horas</h2>
          <p>
            Si cancelas con más de 24 horas de anticipación y tu sesión fue pagada con un crédito de
            paquete, el crédito se devuelve a tu cuenta para una futura reserva.
          </p>
        </div>

        <div>
          <h2 className="section-title mb-2">Cancelación con menos de 24 horas</h2>
          <p>
            Si cancelas con menos de 24 horas de anticipación, no se devuelve el crédito ni el importe
            de la sesión, en consideración al tiempo reservado.
          </p>
        </div>

        <div>
          <h2 className="section-title mb-2">Reprogramación</h2>
          <p>
            Puedes reprogramar tu sesión sujeto a disponibilidad; aplican los mismos plazos que para
            la cancelación.
          </p>
        </div>

        <div>
          <h2 className="section-title mb-2">Cómo se calcula la ventana</h2>
          <p>
            La ventana de 24 horas se calcula respecto a la hora de inicio de la sesión, en la zona
            horaria de la consulta.
          </p>
        </div>

        <p className="muted pt-4">
          Este es un texto base y debe completarse con la política de reembolso monetario para pagos
          que no fueron con crédito, revisada por la profesional responsable.
        </p>
      </section>
    </main>
  );
}
