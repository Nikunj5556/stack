import Link from "next/link";

export default function NotFound() {
  return (
    <div className="page-shell page-stack">
      <section className="empty-panel">
        <p className="eyebrow">404</p>
        <h1>That page could not be found.</h1>
        <p className="muted">The page may have moved or the item may no longer be available.</p>
        <Link className="button" href="/catalog">
          Return to catalog
        </Link>
      </section>
    </div>
  );
}
