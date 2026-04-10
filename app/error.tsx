"use client";

export default function ErrorPage({
  error,
  reset
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="page-shell page-stack">
      <section className="empty-panel">
        <p className="eyebrow">Something went wrong</p>
        <h1>We could not load this page right now.</h1>
        <p className="muted">{error.message}</p>
        <button className="button" onClick={reset} type="button">
          Try again
        </button>
      </section>
    </div>
  );
}
