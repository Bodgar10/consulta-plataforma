import Link from 'next/link';

export function BookCTA({
  tenantSlug,
  label = 'Agenda tu sesión',
  className = '',
}: {
  tenantSlug: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={`/${tenantSlug}/agendar`} className={`btn-primary ${className}`.trim()}>
      {label}
    </Link>
  );
}
