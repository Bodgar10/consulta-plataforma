type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ pago?: string }>;
};

export default async function EventoResultadoPage({ searchParams }: Props) {
  const { pago } = await searchParams;
  const isOk = pago === 'ok';
  const isCancelado = pago === 'cancelado';

  return (
    <main className="min-h-screen bg-cream-50 flex items-center justify-center px-4">
      <div className="card max-w-sm w-full text-center">
        {isOk && (
          <>
            <h1 className="card-title">¡Listo, tu lugar está reservado!</h1>
            <p className="muted mt-2">
              Te enviamos la confirmación de pago y el acceso al evento a tu correo.
            </p>
          </>
        )}
        {isCancelado && (
          <>
            <h1 className="card-title">Pago cancelado</h1>
            <p className="muted mt-2">
              No se completó el pago — tu lugar no quedó reservado. Puedes
              intentarlo de nuevo desde la página del evento.
            </p>
          </>
        )}
        {!isOk && !isCancelado && (
          <>
            <h1 className="card-title">Resultado no reconocido</h1>
            <p className="muted mt-2">
              No pudimos confirmar el estado de tu pago. Si el cargo se
              realizó, revisa tu correo — si no llegó nada, contacta directamente.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
