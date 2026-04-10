"use client";

import { createMetaEventId, trackMetaEvent, waitForMetaDispatch } from "@/lib/meta/browser";

export function BuyNowButton() {
  return (
    <a
      className="button button--ghost"
      href="/checkout"
      onClick={async (event) => {
        if (typeof window === "undefined") {
          return;
        }

        event.preventDefault();
        trackMetaEvent({
          eventName: "InitiateCheckout",
          eventId: createMetaEventId("initiate-checkout"),
          eventSourceUrl: window.location.href
        });
        await waitForMetaDispatch();
        window.location.href = "/checkout";
      }}
    >
      Buy now
    </a>
  );
}
