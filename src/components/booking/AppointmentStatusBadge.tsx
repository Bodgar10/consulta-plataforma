type AppointmentStatus =
  | "pending_payment"
  | "pending_verification"
  | "confirmed"
  | "completed"
  | "cancelled"
  | "no_show";

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  pending_payment: "Pendiente de pago",
  pending_verification: "Pendiente de verificación",
  confirmed: "Confirmada",
  completed: "Completada",
  cancelled: "Cancelada",
  no_show: "No asistió",
};

const STATUS_CLASS: Record<AppointmentStatus, string> = {
  pending_payment: "badge-pending",
  pending_verification: "badge-pending",
  confirmed: "badge-confirmed",
  completed: "badge-confirmed",
  cancelled: "badge-cancelled",
  no_show: "badge-cancelled",
};

export default function AppointmentStatusBadge({
  status,
}: {
  status: AppointmentStatus;
}) {
  return <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}
