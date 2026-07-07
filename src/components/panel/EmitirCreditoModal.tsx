"use client";

import { useEffect, useState } from "react";

interface Package {
  id: string;
  name: string;
  sessions_count: number;
  price_cents: number;
  valid_days: number;
  active: boolean;
}

interface EmitirCreditoModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  patientId: string;
}

export function EmitirCreditoModal({
  open,
  onClose,
  onCreated,
  patientId,
}: EmitirCreditoModalProps) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [packageId, setPackageId] = useState("");
  const [amount, setAmount] = useState(0);
  const [confirmedNotice, setConfirmedNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch("/api/panel/paquetes")
      .then((res) => res.json())
      .then((data) => setPackages((data.packages ?? []).filter((p: Package) => p.active)))
      .catch(() => {});
  }, [open]);

  const selectedPackage = packages.find((p) => p.id === packageId);

  useEffect(() => {
    if (selectedPackage) setAmount(selectedPackage.price_cents / 100);
  }, [selectedPackage]);

  if (!open) return null;

  async function handleSubmit() {
    if (!packageId) {
      setError("Elige un paquete.");
      return;
    }
    if (!confirmedNotice) {
      setError("Confirma que le explicaste la vigencia y la política de no-reembolso.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/panel/pacientes/${patientId}/creditos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          package_id: packageId,
          amount_paid_cents: Math.round(amount * 100),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.message ?? "No se pudo emitir el crédito.");
        return;
      }

      onCreated();
      onClose();
    } catch {
      setError("No se pudo emitir el crédito.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="card max-w-md w-full">
        <h3 className="card-title mb-4">Emitir crédito</h3>

        <div className="mb-3">
          <label className="field-label">Paquete</label>
          <select className="field" value={packageId} onChange={(e) => setPackageId(e.target.value)}>
            <option value="">Selecciona…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.sessions_count} sesiones
              </option>
            ))}
          </select>
        </div>

        <div className="mb-3">
          <label className="field-label">Monto cobrado (MXN)</label>
          <input
            type="number"
            min={0}
            className="field"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>

        {selectedPackage && (
          <div className="card bg-cream-50 mb-3">
            <p className="text-sm text-pine-900">
              Este paquete vence {selectedPackage.valid_days} días después de emitido. Las
              sesiones no usadas al vencer no son reembolsables (política PROFECO).
              Confirma que ya le explicaste esto al paciente antes de continuar.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 mb-4 text-sm text-pine-900">
          <input
            type="checkbox"
            checked={confirmedNotice}
            onChange={(e) => setConfirmedNotice(e.target.checked)}
          />
          Le expliqué la vigencia y la política de no-reembolso.
        </label>

        {error && <p className="field-error mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" disabled={saving} onClick={handleSubmit}>
            {saving ? "Emitiendo…" : "Emitir crédito"}
          </button>
        </div>
      </div>
    </div>
  );
}
