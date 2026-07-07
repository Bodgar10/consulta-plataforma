"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Patient {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  notas_operativas: string | null;
  active_credits: number;
}

export default function PacientesPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/panel/pacientes")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "error_desconocido");
        }
        return res.json();
      })
      .then((data) => setPatients(data.patients ?? []))
      .catch((err) => setError(err.message ?? "No se pudo cargar la lista"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="page-title">Pacientes</h1>

      {error && (
        <div className="card">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Cargando pacientes…</p>
      ) : patients.length === 0 ? (
        <div className="card">
          <p className="muted">Aún no hay pacientes registrados.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-hair text-left">
                <th className="px-4 py-3 font-medium text-pine-700">Nombre</th>
                <th className="px-4 py-3 font-medium text-pine-700">Contacto</th>
                <th className="px-4 py-3 font-medium text-pine-700">Créditos activos</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} className="border-hair last:border-b-0">
                  <td className="px-4 py-3">
                    <Link href={`/pacientes/${patient.id}`} className="btn-ghost">
                      {patient.full_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-pine-900">
                    <div>{patient.email}</div>
                    {patient.phone && <div className="muted">{patient.phone}</div>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{patient.active_credits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
