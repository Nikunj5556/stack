import type { ReactNode } from "react";

export function CatalogSearchForm({
  action,
  query,
  categoryId,
  children
}: {
  action: string;
  query?: string;
  categoryId?: string;
  children?: ReactNode;
}) {
  return (
    <form action={action} className="catalog-toolbar">
      <label className="field catalog-search-field">
        <span>Search products</span>
        <input defaultValue={query || ""} name="q" placeholder="Search templates, kits, bundles, licenses..." />
      </label>
      {categoryId ? <input name="category" type="hidden" value={categoryId} /> : null}
      <div className="catalog-toolbar__actions">
        <button className="button" type="submit">
          Search
        </button>
        {children}
      </div>
    </form>
  );
}
