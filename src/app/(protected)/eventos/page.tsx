"use client";

import { useCallback, useEffect, useState } from "react";
import { DateTime } from "luxon";
import { useTour } from "@/lib/tour/useTour";
import { TourFab } from "@/components/panel/TourFab";

const EVENTOS_TOUR_BASE_STEPS = [
  {
    element: "[data-tour='evento-nuevo']",
    popover: {
      title: "Crear un taller o curso",
      description: "Aquí defines título, fecha, cupo, y si es gratis o de pago. Nace como Borrador, nadie lo ve todavía.",
    },
  },
];

const EVENTOS_TOUR_CARD_STEPS = [
  {
    element: "[data-tour='evento-card']",
    popover: {
      title: "Tus eventos",
      description: "Cada tarjeta es un taller o curso. Mientras diga Borrador, nadie puede verlo ni registrarse.",
    },
  },
  {
    element: "[data-tour='evento-publicar']",
    popover: {
      title: "Publicar",
      description: "Al publicar, el evento aparece en tu página web para que la gente se registre, y se genera el enlace de la videollamada.",
    },
  },
  {
    element: "[data-tour='evento-inscritos']",
    popover: {
      title: "Ver quién se registró",
      description: "Aquí ves la lista de personas inscritas, y puedes copiarla para tenerla a la mano.",
    },
  },
  {
    element: "[data-tour='evento-anunciar']",
    popover: {
      title: "Avisar por correo",
      description: "Manda un correo a tus pacientes y contactos que pidieron que les avises de talleres nuevos, con un botón para que se registren.",
    },
  },
];

const EVENTOS_TOUR_EMPTY_STEP = {
  popover: {
    title: "Todavía no tienes eventos",
    description: "Usa el botón de arriba para crear tu primer taller o curso.",
  },
};

interface LiveEvent {
  id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  capacity: number;
  price_cents: number | null;
  status: string;
  published: boolean;
  created_at: string;
  video_room_url: string | null;
}

interface Registration {
  id: string;
  email: string;
  name: string | null;
  payment_status: string;
  created_at: string;
}

interface EventForm {
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  isFree: boolean;
  price: string; // pesos, no centavos — se convierte al guardar
}

const EMPTY_FORM: EventForm = {
  title: "",
  description: "",
  date: "",
  start_time: "18:00",
  end_time: "19:30",
  capacity: 30,
  isFree: true,
  price: "",
};

const TIME_OPTIONS = Array.from({ length: 24 * 6 }, (_, i) => {
  const hours = String(Math.floor(i / 6)).padStart(2, "0");
  const minutes = String((i % 6) * 10).padStart(2, "0");
  return `${hours}:${minutes}`;
});

function formatPrice(cents: number | null) {
  if (!cents) return "Gratis";
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

function EventosTourFab({ hasEvents }: { hasEvents: boolean }) {
  const steps = hasEvents
    ? [...EVENTOS_TOUR_CARD_STEPS, ...EVENTOS_TOUR_BASE_STEPS]
    : [EVENTOS_TOUR_EMPTY_STEP, ...EVENTOS_TOUR_BASE_STEPS];
  const { startTour } = useTour(steps);
  return <TourFab onClick={startTour} />;
}

export default function EventosPage() {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [inscritosOpenFor, setInscritosOpenFor] = useState<string | null>(null);
  const [inscritos, setInscritos] = useState<Registration[]>([]);
  const [loadingInscritos, setLoadingInscritos] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmAnunciar, setConfirmAnunciar] = useState<string | null>(null);
  const [anunciando, setAnunciando] = useState(false);
  const [anuncioResultado, setAnuncioResultado] = useState<Record<string, string>>({});

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/panel/eventos")
      .then(async (res) => {
        if (!res.ok) throw new Error("error");
        return res.json();
      })
      .then((data) => setEvents(data.events ?? []))
      .catch(() => setError("No se pudieron cargar los eventos"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function handleNuevo() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function handleEditar(ev: LiveEvent) {
    const start = DateTime.fromISO(ev.start_at);
    const end = DateTime.fromISO(ev.end_at);
    setEditingId(ev.id);
    setForm({
      title: ev.title,
      description: ev.description ?? "",
      date: start.toFormat("yyyy-MM-dd"),
      start_time: start.toFormat("HH:mm"),
      end_time: end.toFormat("HH:mm"),
      capacity: ev.capacity,
      isFree: !ev.price_cents,
      price: ev.price_cents ? String(ev.price_cents / 100) : "",
    });
    setFormError(null);
    setShowForm(true);
  }

  function handleCerrarFormulario() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  async function handleGuardar() {
    if (!form.title || !form.date) {
      setFormError("Título y fecha son obligatorios.");
      return;
    }
    setSaving(true);
    setFormError(null);

    const start_at = DateTime.fromISO(`${form.date}T${form.start_time}`).toUTC().toISO();
    const end_at = DateTime.fromISO(`${form.date}T${form.end_time}`).toUTC().toISO();

    const body = {
      title: form.title,
      description: form.description || null,
      start_at,
      end_at,
      capacity: form.capacity,
      price_cents: form.isFree ? null : Math.round(parseFloat(form.price || "0") * 100),
    };

    try {
      const url = editingId ? `/api/panel/eventos/${editingId}` : "/api/panel/eventos";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json();
      if (!res.ok) {
        setFormError(responseBody.message ?? "No se pudo guardar el evento.");
        return;
      }
      handleCerrarFormulario();
      cargar();
    } catch {
      setFormError("No se pudo guardar el evento.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublicado(ev: LiveEvent) {
    await fetch(`/api/panel/eventos/${ev.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !ev.published }),
    });
    cargar();
  }

  async function handleEliminar(id: string) {
    await fetch(`/api/panel/eventos/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    cargar();
  }

  async function handleAnunciar(id: string) {
    setAnunciando(true);
    try {
      const res = await fetch(`/api/panel/eventos/${id}/anunciar`, { method: "POST" });
      const data = await res.json();
      setAnuncioResultado((prev) => ({
        ...prev,
        [id]: res.ok ? `Enviado a ${data.sent} de ${data.total} personas.` : "No se pudo enviar.",
      }));
    } catch {
      setAnuncioResultado((prev) => ({ ...prev, [id]: "No se pudo enviar." }));
    } finally {
      setAnunciando(false);
      setConfirmAnunciar(null);
    }
  }

  async function handleVerInscritos(id: string) {
    if (inscritosOpenFor === id) {
      setInscritosOpenFor(null);
      return;
    }
    setInscritosOpenFor(id);
    setLoadingInscritos(true);
    try {
      const res = await fetch(`/api/panel/eventos/${id}/inscritos`);
      const data = await res.json();
      setInscritos(data.registrations ?? []);
    } finally {
      setLoadingInscritos(false);
    }
  }

  function handleCopiarInscritos() {
    const texto = inscritos
      .map((r) => `${r.name ?? "(sin nombre)"} - ${r.email} - ${r.payment_status}`)
      .join("\n");
    navigator.clipboard.writeText(texto);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="page-title">Eventos</h1>
        {!showForm && (
          <button data-tour="evento-nuevo" className="btn-primary" onClick={handleNuevo}>
            + Nuevo evento
          </button>
        )}
      </div>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="card">
          <p className="card-title mb-4">{editingId ? "Editar evento" : "Nuevo evento"}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label className="field-label">Título</label>
              <input
                className="field"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Taller de introducción al psicoanálisis"
              />
            </div>
            <div>
              <label className="field-label">Descripción (opcional)</label>
              <textarea
                className="field"
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-4">
              <div>
                <label className="field-label">Fecha</label>
                <input
                  type="date"
                  className="field"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <label className="field-label">Inicio</label>
                <select
                  className="field"
                  value={form.start_time}
                  onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Fin</label>
                <select
                  className="field"
                  value={form.end_time}
                  onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="field-label">Cupo</label>
                <input
                  type="number"
                  className="field w-24"
                  value={form.capacity}
                  onChange={(e) => setForm((f) => ({ ...f, capacity: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <label className="field-label mb-2">¿Es gratis?</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-pine-700">
                  <input
                    type="radio"
                    checked={form.isFree}
                    onChange={() => setForm((f) => ({ ...f, isFree: true }))}
                  />
                  Gratis
                </label>
                <label className="flex items-center gap-2 text-sm text-pine-700">
                  <input
                    type="radio"
                    checked={!form.isFree}
                    onChange={() => setForm((f) => ({ ...f, isFree: false }))}
                  />
                  De pago
                </label>
                {!form.isFree && (
                  <input
                    type="number"
                    className="field w-32"
                    placeholder="Precio en $MXN"
                    value={form.price}
                    onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  />
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button className="btn-primary" disabled={saving} onClick={handleGuardar}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear evento"}
            </button>
            <button className="btn-ghost" disabled={saving} onClick={handleCerrarFormulario}>
              Cancelar
            </button>
          </div>
          {formError && <p className="field-error mt-2">{formError}</p>}
        </div>
      )}

      {!loading && <EventosTourFab hasEvents={events.length > 0} />}
      {loading ? (
        <p className="muted">Cargando eventos…</p>
      ) : events.length === 0 ? (
        <div className="card">
          <p className="muted">Todavía no has creado ningún evento.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {events.map((ev) => {
            const start = DateTime.fromISO(ev.start_at).setLocale("es");
            const end = DateTime.fromISO(ev.end_at).setLocale("es");
            const isPast = start < DateTime.now();
            return (
              <div key={ev.id} data-tour="evento-card" className="card">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                  <div>
                    <p className="card-title">{ev.title}</p>
                    <p className="muted mt-1">
                      {start.toFormat("cccc d 'de' LLLL")} · {start.toFormat("HH:mm")}–{end.toFormat("HH:mm")}
                    </p>
                    <p className="muted">
                      {formatPrice(ev.price_cents)} · cupo {ev.capacity}
                      {isPast && " · Ya pasó"}
                    </p>
                    <span className={ev.published ? "badge-confirmed mt-2 inline-flex" : "badge-pending mt-2 inline-flex"}>
                      {ev.published ? "Publicado" : "Borrador"}
                    </span>
                    {anuncioResultado[ev.id] && (
                      <p className="muted mt-1">{anuncioResultado[ev.id]}</p>
                    )}
                    {ev.video_room_url && (
                      <p className="muted mt-1">
                        Sala:{" "}
                        <a href={ev.video_room_url} target="_blank" rel="noopener noreferrer" className="text-pine-700 underline">
                          {ev.video_room_url}
                        </a>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button data-tour="evento-publicar" className="btn-secondary" onClick={() => handleTogglePublicado(ev)}>
                      {ev.published ? "Despublicar" : "Publicar"}
                    </button>
                    <button data-tour="evento-inscritos" className="btn-secondary" onClick={() => handleVerInscritos(ev.id)}>
                      Ver inscritos
                    </button>
                    {confirmAnunciar === ev.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-pine-700">¿Avisar por correo a todos los que dieron su ok?</span>
                        <button className="btn-primary" disabled={anunciando} onClick={() => handleAnunciar(ev.id)}>
                          {anunciando ? "Enviando…" : "Sí, avisar"}
                        </button>
                        <button className="btn-ghost" onClick={() => setConfirmAnunciar(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button data-tour="evento-anunciar" className="btn-secondary" onClick={() => setConfirmAnunciar(ev.id)}>
                        Anunciar por correo
                      </button>
                    )}
                    <button className="btn-ghost" onClick={() => handleEditar(ev)}>
                      Editar
                    </button>
                    {confirmDelete === ev.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-danger-600">¿Seguro? No se avisa a los inscritos.</span>
                        <button className="btn-ghost text-danger-600" onClick={() => handleEliminar(ev.id)}>
                          Sí, eliminar
                        </button>
                        <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button className="btn-ghost text-danger-600" onClick={() => setConfirmDelete(ev.id)}>
                        Eliminar
                      </button>
                    )}
                  </div>
                </div>

                {inscritosOpenFor === ev.id && (
                  <div className="mt-4 pt-4 border-hair">
                    {loadingInscritos ? (
                      <p className="muted">Cargando inscritos…</p>
                    ) : inscritos.length === 0 ? (
                      <p className="muted">Nadie se ha inscrito todavía.</p>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <p className="field-label">{inscritos.length} inscritos</p>
                          <button className="btn-ghost" onClick={handleCopiarInscritos}>
                            Copiar lista
                          </button>
                        </div>
                        <div className="flex flex-col gap-1">
                          {inscritos.map((r) => (
                            <p key={r.id} className="text-sm text-pine-900">
                              {r.name ?? "(sin nombre)"} — {r.email}{" "}
                              <span className="muted">({r.payment_status})</span>
                            </p>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
