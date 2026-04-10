"use client";

import { useState } from "react";

import { safeJson } from "@/lib/utils";

interface SearchResult {
  title: string;
  url: string;
  type: string;
  description: string;
}

interface HelpSearchResponse {
  articles: Array<{ title: string; slug: string; kind: "help" | "guide" }>;
  faqs: Array<{ question: string; seo_slug: string | null }>;
  seoPages: SearchResult[];
}

export function HelpSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<HelpSearchResponse | null>(null);
  const [status, setStatus] = useState("Search help articles, FAQs, guides, and store pages.");

  async function search() {
    if (!query.trim()) {
      setResults(null);
      setStatus("Search help articles, FAQs, guides, and store pages.");
      return;
    }

    try {
      const data = await safeJson<HelpSearchResponse>(await fetch(`/api/help/search?q=${encodeURIComponent(query)}`));
      setResults(data);
      setStatus("Search results updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Search is temporarily unavailable.");
    }
  }

  return (
    <section className="section-block docs-search">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Help search</p>
          <h2>Find answers fast</h2>
        </div>
      </div>
      <div className="form-stack">
        <label className="field">
          <span>Search help content</span>
          <input
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder="Search refunds, downloads, checkout, wallet..."
            value={query}
          />
        </label>
        <div className="button-row">
          <button className="button" onClick={() => void search()} type="button">
            Search
          </button>
        </div>
      </div>
      <p className="muted">{status}</p>

      {results ? (
        <div className="review-grid">
          {results.articles.map((article) => (
            <a
              className="review-card"
              href={article.kind === "guide" ? `/support#guide-${article.slug}` : `/support#help-${article.slug}`}
              key={`article-${article.slug}`}
            >
              <strong>{article.title}</strong>
              <p className="muted">{article.kind === "guide" ? "Guide" : "Help article"}</p>
            </a>
          ))}
          {results.faqs.map((faq) =>
            faq.seo_slug ? (
              <a className="review-card" href={`/faq/${faq.seo_slug}`} key={`faq-${faq.seo_slug}`}>
                <strong>{faq.question}</strong>
                <p className="muted">FAQ</p>
              </a>
            ) : null
          )}
          {results.seoPages.map((page) => (
            <a className="review-card" href={page.url} key={`${page.type}-${page.url}`}>
              <strong>{page.title}</strong>
              <p>{page.type}</p>
              <p className="muted">{page.description}</p>
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
