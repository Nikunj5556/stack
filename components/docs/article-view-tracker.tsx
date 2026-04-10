"use client";

import { useEffect } from "react";

export function ArticleViewTracker({ articleId }: { articleId: string }) {
  useEffect(() => {
    void fetch(`/api/help/${articleId}/view`, {
      method: "POST",
      keepalive: true
    }).catch(() => undefined);
  }, [articleId]);

  return null;
}
