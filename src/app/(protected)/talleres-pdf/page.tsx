"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTour } from "@/lib/tour/useTour";
import { TourFab } from "@/components/panel/TourFab";

interface Workshop {
  id: string;
  title: string;
  description: string | null;
  price_cents: number | null;
  file_path: string | null;
  grants_free_session: boolean;
  published: boolean;
  created_at: string;
}

interface Download {
  id: string;
  email: string;
  name: string | null;
  payment_status: string;
  credit_id: string | null;
  created_at: string;
}

interface WorkshopForm {
  title: string;
  description: string;
  isFree: boolean;
  price: string;
  grantsFreeSession: boolean;
}

const EMPTY_FORM: WorkshopForm = {
  title: "",
  description: "",
  isFree: true,
  price: "",
  grantsFreeSession: false,
};

function formatPrice(cents: number | null) {
  if (!cents) return "Gratis";
  return (cents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

const WORKSHOPS_TOUR_BASE_STEPS = [
  {
    element: "[data-tour='taller-nuevo']",
    popover: {
      title: "Crear un taller para descargar",
      description: "Aquí escribes el título, una descripción, y decides si es gratis o de pago. Nace como Borrador — nadie lo ve todavía.",
    },
  },
];

const WORKSHOPS_TOUR_CARD_STEPS = [
  {
    element: "[data-tour='taller-card']",
    popover: {
      title: "Tus talleres",
      description: "Cada tarjeta es un taller. Mientras diga Borrador o falte subir el PDF, nadie puede comprarlo ni descargarlo.",
    },
  },
  {
    element: "[data-tour='taller-subir']",
    popover: {
      title: "Subir el archivo",
      description: "Aquí subes el PDF real que la gente va a descargar. Puedes cambiarlo después si actualizas el contenido.",
    },
  },
  {
    element: "[data-tour='taller-publicar']",
    popover: {
      title: "Publicar",
      description: "Al publicar (con el PDF ya subido), el taller aparece en tu página web para que la gente lo compre o descargue.",
    },
  },
  {
    element: "[data-tour='taller-compras']",
    popover: {
      title: "Ver quién lo descargó o compró",
      description: "Aquí ves la lista de personas, y si ya pagaron. Si el taller da sesión gratis, también ves si ya la usaron.",
    },
  },
];

const WORKSHOPS_TOUR_EMPTY_STEP = {
  popover: {
    title: "Todavía no tienes talleres",
    description: "Usa el botón de arriba para crear tu primer taller descargable.",
  },
};

export default function TalleresPdfPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WorkshopForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetId = useRef<string | null>(null);

  const [comprasOpenFor, setComprasOpenFor] = useState<string | null>(null);
  const [compras, setCompras] = useState<Download[]>([]);
  const [loadingCompras, setLoadingCompras] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/panel/talleres-pdf")
      .then(async (res) => {
        if (!res.ok) throw new Error("error");
        return res.json();
      })
      .then((data) => setWorkshops(data.workshops ?? []))
      .catch(() => setError("No se pudieron cargar los talleres"))
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

  function handleEditar(w: Workshop) {
    setEditingId(w.id);
    setForm({
      title: w.title,
      description: w.description ?? "",
      isFree: !w.price_cents,
      price: w.price_cents ? String(w.price_cents / 100) : "",
      grantsFreeSession: w.grants_free_session,
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
    if (!form.title) {
      setFormError("El título es obligatorio.");
      return;
    }
    setSaving(true);
    setFormError(null);

    const body = {
      title: form.title,
      description: form.description || null,
      price_cents: form.isFree ? null : Math.round(parseFloat(form.price || "0") * 100),
      grants_free_session: form.isFree ? false : form.grantsFreeSession,
    };

    try {
      const url = editingId ? `/api/panel/talleres-pdf/${editingId}` : "/api/panel/talleres-pdf";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const responseBody = await res.json();
      if (!res.ok) {
        setFormError(responseBody.message ?? "No se pudo guardar el taller.");
        return;
      }
      handleCerrarFormulario();
      cargar();
    } catch {
      setFormError("No se pudo guardar el taller.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTogglePublicado(w: Workshop) {
    if (!w.published && !w.file_path) {
      alert("Primero sube el archivo PDF para poder publicar este taller.");
      return;
    }
    await fetch(`/api/panel/talleres-pdf/${w.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: !w.published }),
    });
    cargar();
  }

  function handleClickSubir(workshopId: string) {
    uploadTargetId.current = workshopId;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const workshopId = uploadTargetId.current;
    if (!file || !workshopId) return;

    setUploadingId(workshopId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/panel/talleres-pdf/${workshopId}/subir`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json();
        alert(body.error === "solo se aceptan archivos PDF" ? "Ese archivo no es un PDF." : "No se pudo subir el archivo.");
        return;
      }
      cargar();
    } finally {
      setUploadingId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleEliminar(id: string) {
    await fetch(`/api/panel/talleres-pdf/${id}`, { method: "DELETE" });
    setConfirmDelete(null);
    cargar();
  }

  async function handleVerCompras(id: string) {
    if (comprasOpenFor === id) {
      setComprasOpenFor(null);
      return;
    }
    setComprasOpenFor(id);
    setLoadingCompras(true);
    try {
      const res = await fetch(`/api/panel/talleres-pdf/${id}/compras`);
      const data = await res.json();
      setCompras(data.downloads ?? []);
    } finally {
      setLoadingCompras(false);
    }
  }

  function handleCopiarCompras() {
    const texto = compras
      .map((d) => `${d.name ?? "(sin nombre)"} - ${d.email} - ${d.payment_status}${d.credit_id ? " - usó sesión gratis" : ""}`)
      .join("\n");
    navigator.clipboard.writeText(texto);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <h1 className="page-title">Talleres PDF</h1>
        {!showForm && (
          <button data-tour="taller-nuevo" className="btn-primary" onClick={handleNuevo}>
            + Nuevo taller
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileSelected}
      />

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {showForm && (
        <div className="card">
          <p className="card-title mb-4">{editingId ? "Editar taller" : "Nuevo taller"}</p>
          <div className="flex flex-col gap-4">
            <div>
              <label className="field-label">Título</label>
              <input
                className="field"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Ej: Guía para entender la ansiedad"
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
            <div>
              <label className="field-label mb-2">¿Es gratis?</label>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-sm text-pine-700">
                  <input
                    type="radio"
                    checked={form.isFree}
                    onChange={() => setForm((f) => ({ ...f, isFree: true, grantsFreeSession: false }))}
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
            {!form.isFree && (
              <label className="flex items-center gap-2 text-sm text-pine-700">
                <input
                  type="checkbox"
                  checked={form.grantsFreeSession}
                  onChange={(e) => setForm((f) => ({ ...f, grantsFreeSession: e.target.checked }))}
                />
                Incluye una sesión de terapia gratis al comprarlo
              </label>
            )}
          </div>
          <div className="flex items-center gap-2 mt-5">
            <button className="btn-primary" disabled={saving} onClick={handleGuardar}>
              {saving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear taller"}
            </button>
            <button className="btn-ghost" disabled={saving} onClick={handleCerrarFormulario}>
              Cancelar
            </button>
          </div>
          {formError && <p className="field-error mt-2">{formError}</p>}
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando talleres…</p>
      ) : workshops.length === 0 ? (
        <div className="card">
          <p className="muted">Todavía no has creado ningún taller.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {workshops.map((w) => (
            <div key={w.id} data-tour="taller-card" className="card">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div>
                  <p className="card-title">{w.title}</p>
                  <p className="muted mt-1">
                    {formatPrice(w.price_cents)}
                    {w.grants_free_session && " · incluye sesión gratis"}
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className={w.published ? "badge-confirmed" : "badge-pending"}>
                      {w.published ? "Publicado" : "Borrador"}
                    </span>
                    {!w.file_path && (
                      <span className="badge-pending-verification">Falta subir el PDF</span>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    data-tour="taller-subir"
                    className="btn-secondary"
                    disabled={uploadingId === w.id}
                    onClick={() => handleClickSubir(w.id)}
                  >
                    {uploadingId === w.id ? "Subiendo…" : w.file_path ? "Cambiar PDF" : "Subir PDF"}
                  </button>
                  <button data-tour="taller-publicar" className="btn-secondary" onClick={() => handleTogglePublicado(w)}>
                    {w.published ? "Despublicar" : "Publicar"}
                  </button>
                  <button data-tour="taller-compras" className="btn-secondary" onClick={() => handleVerCompras(w.id)}>
                    Ver compras
                  </button>
                  <button className="btn-ghost" onClick={() => handleEditar(w)}>
                    Editar
                  </button>
                  {confirmDelete === w.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-danger-600">¿Seguro?</span>
                      <button className="btn-ghost text-danger-600" onClick={() => handleEliminar(w.id)}>
                        Sí, eliminar
                      </button>
                      <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button className="btn-ghost text-danger-600" onClick={() => setConfirmDelete(w.id)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>

              {comprasOpenFor === w.id && (
                <div className="mt-4 pt-4 border-hair">
                  {loadingCompras ? (
                    <p className="muted">Cargando…</p>
                  ) : compras.length === 0 ? (
                    <p className="muted">Nadie lo ha descargado ni comprado todavía.</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-2">
                        <p className="field-label">{compras.length} personas</p>
                        <button className="btn-ghost" onClick={handleCopiarCompras}>
                          Copiar lista
                        </button>
                      </div>
                      <div className="flex flex-col gap-1">
                        {compras.map((d) => (
                          <p key={d.id} className="text-sm text-pine-900">
                            {d.name ?? "(sin nombre)"} — {d.email}{" "}
                            <span className="muted">
                              ({d.payment_status}{d.credit_id ? ", usó sesión gratis" : ""})
                            </span>
                          </p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && <WorkshopsTourFab hasWorkshops={workshops.length > 0} />}
    </div>
  );
}

function WorkshopsTourFab({ hasWorkshops }: { hasWorkshops: boolean }) {
  const steps = hasWorkshops
    ? [...WORKSHOPS_TOUR_CARD_STEPS, ...WORKSHOPS_TOUR_BASE_STEPS]
    : [WORKSHOPS_TOUR_EMPTY_STEP, ...WORKSHOPS_TOUR_BASE_STEPS];
  const { startTour } = useTour(steps);
  return <TourFab onClick={startTour} />;
}
