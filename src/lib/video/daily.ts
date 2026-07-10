interface CreateRoomArgs {
  name: string;    // nombre único de la sala (p.ej. appt-<id> de cita, event-<id> de evento)
  startAt: string; // ISO
  endAt: string;   // ISO
}

/**
 * Crea una sala Daily (cita o evento). Devuelve la URL o null si falla.
 * NUNCA lanza: un fallo de Daily no debe tumbar la confirmación del pago.
 * La sala expira poco después del fin de la sesión (nbf/exp por privacidad).
 */
export async function createDailyRoom(args: CreateRoomArgs): Promise<string | null> {
  const apiKey = process.env.DAILY_API_KEY;
  const domain = process.env.DAILY_DOMAIN;
  if (!apiKey) {
    console.error('daily: falta DAILY_API_KEY');
    return null;
  }

  const exp = Math.floor(new Date(args.endAt).getTime() / 1000) + 60 * 30; // +30 min de colchón
  const nbf = Math.floor(new Date(args.startAt).getTime() / 1000) - 60 * 15; // -15 min antes

  try {
    const res = await fetch('https://api.daily.co/v1/rooms', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: args.name,
        privacy: 'private',
        properties: {
          nbf,
          exp,
          enable_prejoin_ui: true,
          eject_at_room_exp: true,
        },
      }),
    });

    if (!res.ok) {
      // 400 con "already exists" => reusar la sala existente (idempotencia).
      const body = await res.json().catch(() => ({}));
      if (res.status === 400 && String(body?.info ?? '').includes('already exists')) {
        return domain ? `https://${domain}/${args.name}` : null;
      }
      console.error('daily: error creando sala', res.status, body);
      return null;
    }

    const room = (await res.json()) as { url?: string; name?: string };
    return room.url ?? (domain && room.name ? `https://${domain}/${room.name}` : null);
  } catch (err) {
    console.error('daily: excepción creando sala', err);
    return null;
  }
}
