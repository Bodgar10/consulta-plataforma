import { UTMPersistence } from '@/components/funnel/UTMPersistence';
import { LegalFooter } from '@/components/legal/LegalFooter';

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return (
    <>
      <UTMPersistence />
      {children}
      <LegalFooter tenantSlug={tenant} />
    </>
  );
}
