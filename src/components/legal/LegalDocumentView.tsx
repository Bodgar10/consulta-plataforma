import type { LegalDocument } from '@/lib/legal/get-legal-document';

export function LegalDocumentView({
  doc,
  fallbackTitle,
}: {
  doc: LegalDocument | null;
  fallbackTitle: string;
}) {
  if (!doc) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="page-title mb-2">{fallbackTitle}</h1>
        <p className="muted">Este documento está en preparación. Vuelve pronto.</p>
      </main>
    );
  }

  const { title, sections } = doc.content ?? {};
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="page-title mb-2">{title ?? fallbackTitle}</h1>
      <p className="muted mb-8">Versión {doc.version}</p>
      <section className="space-y-6 text-body text-pine-900 leading-relaxed">
        {(sections ?? []).map((s, i) => (
          <div key={i}>
            <h2 className="section-title mb-2">{s.heading}</h2>
            <p className="whitespace-pre-line">{s.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
