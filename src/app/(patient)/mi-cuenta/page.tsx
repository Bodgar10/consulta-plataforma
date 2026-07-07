"use client";

import { useEffect, useState } from "react";
import { DateTime } from "luxon";
import { createClient } from "@/utils/supabase/client";
import { getStatusBadge } from "@/lib/panel/status-badge";

interface PatientAppointment {
  id: string;
  start_at: string;
  end_at: string;
  status: string;
  video_room_url: string | null;
}

export default function MiCuentaPage() {
  const [appointments, setAppointments] = useState<PatientAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    supabase
      .from("appointments")
      .select("id, start_at, end_at, status, video_room_url")
      .order("start_at", { ascending: false })
      .then(({ data, error: queryError }) => {
        if (queryError) {
          setError("No se pudieron cargar tus citas.");
        } else {
          setAppointments(data ?? []);
        }
        setLoading(false);
      });
  }, []);

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="page-title">Mi cuenta</h1>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando tus citas…</p>
      ) : appointments.length === 0 ? (
        <div className="card">
          <p className="muted">Todavía no tienes citas agendadas.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {appointments.map((appt) => {
            const start = DateTime.fromISO(appt.start_at, { zone: "utc" });
            const end = DateTime.fromISO(appt.end_at, { zone: "utc" });
            const { badgeClass, label } = getStatusBadge(appt.status);

            return (
              <div key={appt.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-pine-900 font-medium tabular-nums">
                    {start.toFormat("d LLL yyyy, HH:mm")}–{end.toFormat("HH:mm")}
                  </p>
                  <span className={badgeClass}>{label}</span>
                </div>
                {appt.status === "confirmed" && appt.video_room_url && (
                  <a
                    href={appt.video_room_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                  >
                    Entrar a la sesión
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
