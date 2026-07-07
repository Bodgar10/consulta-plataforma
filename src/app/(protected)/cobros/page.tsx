"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";

interface PendingAppointment {
  id: string;
  start_at: string;
  end_at: string;
  amount_paid_cents: number;
  created_at: string;
  patient: { full_name: string; email: string };
}

export default function CobrosPage() {
  const [pending, setPending] = useState<PendingAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/panel/por-verificar")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "error_desconocido");
        }
        return res.json();
      })
      .then((data) => setPending(data.pending ?? []))
      .catch((err) => setError(err.message ?? "No se pudo cargar la bandeja"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleConfirmar(id: string) {
    setConfirmingId(id);
    setRowError((prev) => ({ ...prev, [id]: "" }));

    // Optimistic: la sacamos de la bandeja antes de esperar la respuesta.
    const previous = pending;
    setPending((prev) => prev.filter((p) => p.id !== id));

    try {
      const res = await fetch(`/api/appointments/${id}/confirm-transfer`, {
        method: "POST",
      });
      const body = await res.json();

      if (!res.ok) {
        // Revertir: la cita sigue pendiente.
        setPending(previous);
        const message =
          body.error === "invalid_state"
            ? body.message ?? "Esta cita ya no está esperando verificación."
            : body.error === "not_found"
            ? "No se encontró la cita."
            : "No se pudo confirmar el pago.";
        setRowError((prev) => ({ ...prev, [id]: message }));
        return;
      }

      // 200 con o sin idempotent:true — ambos son éxito.
      await cargar();
    } catch {
      setPending(previous);
      setRowError((prev) => ({ ...prev, [id]: "No se pudo confirmar el pago." }));
    } finally {
      setConfirmingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Cobros por verificar</h1>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : pending.length === 0 ? (
        <div className="card">
          <p className="muted">No hay transferencias pendientes de verificar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {pending.map((appt) => {
            const start = DateTime.fromISO(appt.start_at, { zone: "utc" });
            return (
              <div key={appt.id} className="card flex items-center justify-between">
                <div>
                  <p className="text-pine-900 font-medium">{appt.patient.full_name}</p>
                  <p className="muted">{appt.patient.email}</p>
                  <p className="text-sm tabular-nums mt-1">
                    {start.toFormat("d LLL yyyy, HH:mm")} ·{" "}
                    {(appt.amount_paid_cents / 100).toLocaleString("es-MX", {
                      style: "currency",
                      currency: "MXN",
                    })}
                  </p>
                  {rowError[appt.id] && (
                    <p className="field-error">{rowError[appt.id]}</p>
                  )}
                </div>
                <button
                  className="btn-primary"
                  disabled={confirmingId === appt.id}
                  onClick={() => handleConfirmar(appt.id)}
                >
                  {confirmingId === appt.id ? "Confirmando…" : "Marcar como pagada"}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
