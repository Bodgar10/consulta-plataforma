import type { createClient } from '@/utils/supabase/server';
import { createDailyRoom } from '@/lib/video/daily';

/**
 * Asegura la sala Daily del evento (idempotente, guard is-null anti-carrera).
 * Se llama al PUBLICAR el evento desde el panel, no al primer inscrito —
 * así la profesional tiene el link disponible de inmediato para probarlo o
 * compartirlo antes de que llegue nadie.
 */
export async function ensureEventRoom(
  supabase: Awaited<ReturnType<typeof createClient>>,
  eventId: string,
): Promise<string | null> {
  const { data: ev } = await supabase
    .from('live_events')
    .select('video_room_url, start_at, end_at')
    .eq('id', eventId)
    .single();

  if (ev?.video_room_url) return ev.video_room_url;
  if (!ev) return null;

  const roomUrl = await createDailyRoom({
    name: `event-${eventId}`,
    startAt: ev.start_at,
    endAt: ev.end_at,
  });

  if (roomUrl) {
    await supabase
      .from('live_events')
      .update({ video_room_url: roomUrl })
      .eq('id', eventId)
      .is('video_room_url', null);
  }

  return roomUrl;
}
