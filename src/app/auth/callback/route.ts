import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: context, error: contextError } = await supabase
        .rpc("current_user_context")
        .maybeSingle();

      if (!contextError && context) {
        if (context.is_professional) {
          return NextResponse.redirect(`${origin}/${context.tenant_slug}/panel`);
        }
        return NextResponse.redirect(`${origin}/mi-cuenta`);
      }

      // Sin contexto todavía (0 filas, usuario recién creado) o error en la RPC:
      // cae al destino original en vez de romper el login.
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
