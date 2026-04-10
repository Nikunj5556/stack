"use client";

import { useEffect } from "react";

import { createMetaEventId, trackMetaEvent } from "@/lib/meta/browser";

export function ProductViewTracker() {
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    trackMetaEvent({
      eventName: "ViewContent",
      eventId: createMetaEventId("view-content"),
      eventSourceUrl: window.location.href
    });
  }, []);

  return null;
}
