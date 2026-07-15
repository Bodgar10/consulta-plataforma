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

  const { data: context } = await supabase.rpc("current_user_context").maybeSingle();

  if (!context?.is_professional) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <aside className="md:w-56 shrink-0 border-b md:border-b-0 md:border-r border-sand-200 px-4 py-3 md:py-6">
        <PanelNav />
      </aside>
      <main className="flex-1 px-4 md:px-8 py-6 overflow-x-hidden">{children}</main>
    </div>
  );
}
