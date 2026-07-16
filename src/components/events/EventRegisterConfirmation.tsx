interface Props {
  eventTitle: string;
  eventDate: string;
  roomUrl: string | null;
}

export default function EventRegisterConfirmation({ eventTitle, eventDate, roomUrl }: Props) {
  return (
    <div className="card text-center">
      <h3 className="card-title">¡Registrado! Te esperamos.</h3>
      <p className="muted mt-2">
        {eventTitle} · {eventDate}
      </p>
      {roomUrl && (
        <a href={roomUrl} className="btn-primary mt-4 inline-block">
          Entrar a la sesión
        </a>
      )}
      <p className="muted mt-3">También te enviamos esta información por correo.</p>
    </div>
  );
}
