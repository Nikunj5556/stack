export function StructuredData({ data }: { data: Record<string, unknown> }) {
  return <script dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} type="application/ld+json" />;
}
