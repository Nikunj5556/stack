function buildPageHref(basePath: string, params: URLSearchParams, page: number) {
  const nextParams = new URLSearchParams(params);
  if (page <= 1) {
    nextParams.delete("page");
  } else {
    nextParams.set("page", String(page));
  }

  const query = nextParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

export function Pagination({
  basePath,
  currentPage,
  totalPages,
  params
}: {
  basePath: string;
  currentPage: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1).filter((page) => {
    return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
  });

  return (
    <nav aria-label="Catalog pagination" className="pagination">
      <a
        aria-disabled={currentPage <= 1}
        className={`filter-pill ${currentPage <= 1 ? "filter-pill--disabled" : ""}`}
        href={buildPageHref(basePath, searchParams, currentPage - 1)}
      >
        Previous
      </a>
      {pages.map((page, index) => (
        <span className="pagination__group" key={page}>
          {index > 0 && pages[index - 1] !== page - 1 ? <span className="pagination__gap">...</span> : null}
          <a
            className={page === currentPage ? "filter-pill filter-pill--active" : "filter-pill"}
            href={buildPageHref(basePath, searchParams, page)}
          >
            {page}
          </a>
        </span>
      ))}
      <a
        aria-disabled={currentPage >= totalPages}
        className={`filter-pill ${currentPage >= totalPages ? "filter-pill--disabled" : ""}`}
        href={buildPageHref(basePath, searchParams, currentPage + 1)}
      >
        Next
      </a>
    </nav>
  );
}
