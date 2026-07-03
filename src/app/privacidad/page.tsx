export const metadata = {
  title: "Aviso de privacidad",
};

export default function PrivacidadPage() {
  const version = process.env.NEXT_PUBLIC_PRIVACY_VERSION ?? "1.0.0";

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="space-y-1.5">
          <h1 className="page-title">Aviso de privacidad</h1>
          <p className="muted">Versión {version}</p>
        </div>

        <div className="card space-y-5 text-sm text-pine-900 leading-relaxed">
          <p className="muted">
            Plantilla base conforme a la Ley Federal de Protección de Datos Personales en
            Posesión de los Particulares (LFPDPPP). La profesional responsable debe revisarla
            y completarla con sus datos reales antes de operar.
          </p>

          <section className="space-y-1.5">
            <h2 className="card-title">Responsable del tratamiento</h2>
            <p>
              La profesional de la salud titular de esta plataforma es responsable del uso y
              protección de tus datos personales, y al respecto te informa lo siguiente.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="card-title">Datos que recabamos</h2>
            <p>
              Nombre completo, correo electrónico y teléfono, con el fin de agendar y gestionar
              tus sesiones. No recabamos datos clínicos ni información sensible a través de este
              formulario de agenda.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="card-title">Finalidades</h2>
            <p>
              Utilizamos tus datos para: agendar y confirmar tu cita, procesar el pago de la
              sesión, enviarte recordatorios y el enlace de la videollamada, y llevar el control
              administrativo de tus sesiones.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="card-title">Transferencias</h2>
            <p>
              Tus datos pueden ser tratados por proveedores que nos ayudan a operar (pagos,
              envío de correo y videollamada), únicamente para las finalidades anteriores. No
              vendemos ni comercializamos tus datos personales.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="card-title">Derechos ARCO</h2>
            <p>
              Puedes ejercer tus derechos de Acceso, Rectificación, Cancelación u Oposición
              (ARCO), así como revocar tu consentimiento, contactando a la profesional
              responsable por los medios que te haya proporcionado.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="card-title">Cambios al aviso</h2>
            <p>
              Este aviso puede actualizarse. La versión vigente se identifica con el número
              mostrado al inicio de esta página.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
