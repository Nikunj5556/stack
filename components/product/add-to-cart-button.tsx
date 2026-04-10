"use client";

import { useState } from "react";

import { useCart } from "@/hooks/use-cart";
import { createMetaEventId, trackMetaEvent } from "@/lib/meta/browser";

export function AddToCartButton(props: {
  productId: string;
  slug: string;
  name: string;
  price: number;
  image: string | null;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <button
      className="button"
      onClick={() => {
        addItem({
          productId: props.productId,
          slug: props.slug,
          name: props.name,
          price: props.price,
          image: props.image,
          quantity: 1
        });
        if (typeof window !== "undefined") {
          trackMetaEvent({
            eventName: "AddToCart",
            eventId: createMetaEventId("add-to-cart"),
            eventSourceUrl: window.location.href
          });
        }
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1200);
      }}
      type="button"
    >
      {added ? "Added to cart" : "Add to cart"}
    </button>
  );
}
