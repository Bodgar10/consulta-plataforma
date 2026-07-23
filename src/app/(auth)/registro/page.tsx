import { redirect } from 'next/navigation';

// DEUDA TÉCNICA (multi-tenant): esta ruta genérica de registro se eliminó como
// puerta independiente. El registro SIEMPRE debe nacer con contexto de tenant
// ([tenant]/registro, que resuelve tenant_id, ancla el emailRedirectTo a
// link-callback y guarda full_name en metadata). Mientras exista un solo tenant
// (piloto), redirigimos al slug por defecto definido en env. Cuando haya
// multi-tenant real, esta ruta debe desaparecer o resolver el tenant de otro
// modo (p. ej. selector), NO seguir mandando todo a un slug fijo.
export default function RegistroRedirectPage() {
  const defaultSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT_SLUG;
  redirect(defaultSlug ? `/${defaultSlug}/registro` : '/login');
}
