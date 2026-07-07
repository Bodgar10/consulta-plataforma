"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { EmitirCreditoModal } from "@/components/panel/EmitirCreditoModal";

interface Patient {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  notas_operativas: string | null;
  active_credits: number;
}

const NOTA_MAX = 2000;

export default function FichaPacientePage() {
  const params = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [showEmitirCredito, setShowEmitirCredito] = useState(false);

  function cargarPaciente() {
    return fetch("/api/panel/pacientes")
      .then(async (res) => {
        if (!res.ok) throw new Error("error_desconocido");
        return res.json();
      })
      .then((data) => {
        const found = (data.patients ?? []).find((p: Patient) => p.id === params.id);
        if (!found) throw new Error("not_found");
        setPatient(found);
        setNota(found.notas_operativas ?? "");
      })
      .catch((err) => setError(err.message ?? "No se pudo cargar el paciente"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarPaciente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function handleGuardar() {
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    try {
      const res = await fetch(`/api/panel/pacientes/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notas_operativas: nota || null }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (body.error === "nota_demasiado_larga") {
          setSaveError(body.message ?? "La nota excede el límite permitido.");
        } else if (body.error === "not_found") {
          setSaveError("Este paciente ya no está disponible.");
        } else {
          setSaveError("No se pudo guardar la nota.");
        }
        return;
      }

      setNota(body.patient.notas_operativas ?? "");
      setSaved(true);
    } catch {
      setSaveError("No se pudo guardar la nota.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="muted">Cargando…</p>;
  if (error || !patient) {
    return (
      <div className="card">
        <p className="text-sm text-danger-600">{error ?? "Paciente no encontrado"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <h1 className="page-title">{patient.full_name}</h1>

      <div className="card">
        <h3 className="card-title mb-3">Contacto</h3>
        <p className="text-pine-900">{patient.email}</p>
        {patient.phone && <p className="text-pine-900">{patient.phone}</p>}
        <div className="flex items-center justify-between mt-2">
          <p className="muted">Créditos activos: {patient.active_credits}</p>
          <button className="btn-secondary" onClick={() => setShowEmitirCredito(true)}>
            Emitir crédito
          </button>
        </div>
      </div>

      <EmitirCreditoModal
        open={showEmitirCredito}
        onClose={() => setShowEmitirCredito(false)}
        onCreated={() => {
          setLoading(true);
          cargarPaciente();
        }}
        patientId={patient.id}
      />

      <div className="card">
        <label className="field-label" htmlFor="nota-operativa">
          Nota operativa
        </label>
        <p className="muted mb-2">
          No es para notas clínicas — la historia clínica va fuera del sistema.
        </p>
        <textarea
          id="nota-operativa"
          className="field h-32"
          maxLength={NOTA_MAX}
          value={nota}
          onChange={(e) => {
            setNota(e.target.value);
            setSaved(false);
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-sm text-sand-700">
            {nota.length}/{NOTA_MAX}
          </span>
          <button className="btn-primary" disabled={saving} onClick={handleGuardar}>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
        {saveError && <p className="field-error">{saveError}</p>}
        {saved && !saveError && <p className="text-sm text-pine-600 mt-1.5">Nota guardada.</p>}
      </div>
    </div>
  );
}
