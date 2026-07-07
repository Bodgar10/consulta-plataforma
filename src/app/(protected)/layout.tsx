import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { PanelNav } from "@/components/panel/PanelNav";

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-sand-200 px-4 py-6">
        <PanelNav />
      </aside>
      <main className="flex-1 px-8 py-6">{children}</main>
    </div>
  );
}
