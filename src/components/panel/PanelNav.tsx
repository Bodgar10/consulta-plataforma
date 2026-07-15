"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

const NAV_ITEMS = [
  { href: "/agenda", label: "Agenda" },
  { href: "/pacientes", label: "Pacientes" },
  { href: "/cobros", label: "Cobros" },
  { href: "/agenda/horarios", label: "Horarios" },
  { href: "/paquetes", label: "Paquetes" },
] as const;

export function PanelNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/agenda" && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              (isActive
                ? "btn-secondary justify-start"
                : "btn-ghost justify-start px-5 py-2.5") + " whitespace-nowrap shrink-0"
            }
          >
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleLogout}
        className="btn-ghost justify-start px-5 py-2.5 whitespace-nowrap shrink-0 text-danger-600 md:mt-4"
      >
        Cerrar sesión
      </button>
    </nav>
  );
}
