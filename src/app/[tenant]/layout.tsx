import { UTMPersistence } from '@/components/funnel/UTMPersistence';

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <UTMPersistence />
      {children}
    </>
  );
}
