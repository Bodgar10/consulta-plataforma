// Mapeo único status de cita -> clase badge + etiqueta visible.
// Usado por AgendaView (panel) y /mi-cuenta (portal del paciente) para no
// duplicar el mapeo en dos lugares.

export type AppointmentStatus =
  | "pending_payment"
  | "pending_verification"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

interface StatusBadgeInfo {
  badgeClass: string;
  label: string;
}

const STATUS_MAP: Record<AppointmentStatus, StatusBadgeInfo> = {
  pending_payment: { badgeClass: "badge-pending", label: "Esperando pago" },
  pending_verification: {
    badgeClass: "badge-pending-verification",
    label: "Por verificar",
  },
  confirmed: { badgeClass: "badge-confirmed", label: "Confirmada" },
  completed: { badgeClass: "badge-completed", label: "Completada" },
  cancelled: { badgeClass: "badge-cancelled", label: "Cancelada" },
  no_show: { badgeClass: "badge-no-show", label: "No asistió" },
};

export function getStatusBadge(status: string): StatusBadgeInfo {
  return (
    STATUS_MAP[status as AppointmentStatus] ?? {
      badgeClass: "badge-pending",
      label: status,
    }
  );
}
