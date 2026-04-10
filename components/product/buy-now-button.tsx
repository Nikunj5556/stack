"use client";

import { useCart } from "@/hooks/use-cart";
import { createMetaEventId, trackMetaEvent, waitForMetaDispatch } from "@/lib/meta/browser";

export function BuyNowButton(props: {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
}) {
  const { addItem } = useCart();

  return (
    <a
      className="button button--ghost"
      href="/checkout"
      onClick={async (event) => {
        if (typeof window === "undefined") {
          return;
        }

        event.preventDefault();
        addItem({
          productId: props.productId,
          slug: props.slug,
          name: props.name,
          price: props.price,
          image: props.image,
          quantity: 1
        });
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
