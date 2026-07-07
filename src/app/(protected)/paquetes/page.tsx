"use client";

import { useCallback, useEffect, useState } from "react";

interface Package {
  id: string;
  name: string;
  sessions_count: number;
  price_cents: number;
  valid_days: number;
  active: boolean;
}

const EMPTY_FORM = { name: "", sessions_count: 1, price_cents: 0, valid_days: 180 };

export default function PaquetesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    setLoading(true);
    setError(null);
    return fetch("/api/panel/paquetes")
      .then(async (res) => {
        if (!res.ok) throw new Error("error_desconocido");
        return res.json();
      })
      .then((data) => setPackages(data.packages ?? []))
      .catch(() => setError("No se pudieron cargar los paquetes"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleCrear() {
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/panel/paquetes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error ?? "No se pudo crear el paquete");
        return;
      }
      setForm(EMPTY_FORM);
      cargar();
    } catch {
      setFormError("No se pudo crear el paquete");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(pkg: Package) {
    await fetch("/api/panel/paquetes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: pkg.id, active: !pkg.active }),
    });
    cargar();
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="page-title">Paquetes</h1>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando…</p>
      ) : (
        <div className="flex flex-col gap-2">
          {packages.length === 0 && <p className="muted">Aún no hay paquetes.</p>}
          {packages.map((pkg) => (
            <div key={pkg.id} className="card flex items-center justify-between">
              <div>
                <p className="text-pine-900 font-medium">{pkg.name}</p>
                <p className="muted">
                  {pkg.sessions_count} sesiones ·{" "}
                  {(pkg.price_cents / 100).toLocaleString("es-MX", {
                    style: "currency",
                    currency: "MXN",
                  })}{" "}
                  · vence en {pkg.valid_days} días
                </p>
              </div>
              <button className="btn-secondary" onClick={() => handleToggleActive(pkg)}>
                {pkg.active ? "Desactivar" : "Activar"}
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h3 className="card-title mb-4">Nuevo paquete</h3>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[160px]">
            <label className="field-label">Nombre</label>
            <input
              className="field"
              placeholder="5 sesiones"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Sesiones</label>
            <input
              type="number"
              min={1}
              className="field w-20"
              value={form.sessions_count}
              onChange={(e) => setForm((f) => ({ ...f, sessions_count: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="field-label">Precio (MXN)</label>
            <input
              type="number"
              min={0}
              className="field w-28"
              value={form.price_cents / 100}
              onChange={(e) =>
                setForm((f) => ({ ...f, price_cents: Math.round(Number(e.target.value) * 100) }))
              }
            />
          </div>
          <div>
            <label className="field-label">Vigencia (días)</label>
            <input
              type="number"
              min={1}
              className="field w-24"
              value={form.valid_days}
              onChange={(e) => setForm((f) => ({ ...f, valid_days: Number(e.target.value) }))}
            />
          </div>
          <button className="btn-primary" disabled={saving} onClick={handleCrear}>
            {saving ? "Creando…" : "Crear paquete"}
          </button>
        </div>
        {formError && <p className="field-error">{formError}</p>}
      </div>
    </div>
  );
}
