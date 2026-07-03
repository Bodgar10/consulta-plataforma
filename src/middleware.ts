import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// Resolvedor de tenant trilateral: dominio custom > subdominio > path.
// Coordina con Opus la firma de public_get_tenant_by_slug (Sprint 0, ya vivo).
function resolveTenantSlug(request: NextRequest): { slug: string | null; via: "domain" | "subdomain" | "path" | "none" } {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // 1) Dominio custom registrado → se resuelve contra tenants.custom_domain
  //    (la validación real contra BD la hace la ruta pública al llamar
  //    public_get_tenant_by_slug; aquí solo detectamos que NO es nuestro dominio base).
  const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || "";
  if (baseDomain && !hostname.endsWith(baseDomain) && hostname !== "localhost") {
    return { slug: null, via: "domain" }; // el resolver de la app busca por custom_domain, no por slug
  }

  // 2) Subdominio: {slug}.dominio.com
  if (baseDomain && hostname.endsWith(`.${baseDomain}`)) {
    const sub = hostname.replace(`.${baseDomain}`, "");
    if (sub && sub !== "www") {
      return { slug: sub, via: "subdomain" };
    }
  }

  // 3) Fallback a path: /[tenant]/...
  const pathSlug = request.nextUrl.pathname.split("/")[1] || null;
  if (pathSlug) {
    return { slug: pathSlug, via: "path" };
  }

  return { slug: null, via: "none" };
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresca la sesión (necesario para que Server Components vean al usuario logueado).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resolved = resolveTenantSlug(request);
  let slug = resolved.slug;

  // Modo dominio custom: el resolvedor detectó un dominio propio pero sin slug.
  // Lo resolvemos con la RPC public_get_tenant_by_domain (010, expone slug) y
  // llenamos x-tenant-slug, para que getTenantSlug() y las páginas [tenant]
  // (slug-based) sigan funcionando igual. Solo se llama en dominios custom;
  // el piloto path-based y los subdominios ya traen slug y no la tocan.
  if (!slug && resolved.via === "domain") {
    const hostname = (request.headers.get("host") || "").split(":")[0];
    const { data } = await supabase
      .rpc("public_get_tenant_by_domain", { p_domain: hostname })
      .maybeSingle();
    slug = data?.slug ?? null;
  }

  if (slug) {
    supabaseResponse.headers.set("x-tenant-slug", slug);
  }
  supabaseResponse.headers.set("x-tenant-resolved-via", resolved.via);

  // Rutas protegidas (panel profesional / portal paciente) sin sesión → login.
  // El panel vive en /[slug]/panel, así que matcheamos el segmento /panel en
  // cualquier posición, además de /mi-cuenta.
  const path = request.nextUrl.pathname;
  const isProtected = path.startsWith("/mi-cuenta") || /\/panel(\/|$)/.test(path);

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
