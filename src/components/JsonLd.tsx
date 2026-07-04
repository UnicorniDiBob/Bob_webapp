// Inietta dati strutturati schema.org come JSON-LD.
// Uso: <JsonLd data={{ "@context": "https://schema.org", ... }} />
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
