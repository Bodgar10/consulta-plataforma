"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/cobros", label: "Cobros" },
  { href: "/agenda/horarios", label: "Horarios" },
  { href: "/paquetes", label: "Paquetes" },
] as const;

export function PanelNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/agenda" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              isActive
                ? "btn-secondary justify-start"
                : "btn-ghost justify-start px-5 py-2.5"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
