import Link from 'next/link';

export function BookCTA({
  tenantSlug,
  label = 'Agenda tu sesión',
  className = '',
  size = 'lg',
}: {
  tenantSlug: string;
  label?: string;
  className?: string;
  size?: 'lg' | 'default';
}) {
  const base = size === 'lg' ? 'btn-primary-lg' : 'btn-primary';
  return (
    <Link href={`/${tenantSlug}/agendar`} className={`${base} ${className}`.trim()}>
      {label}
    </Link>
  );
}
