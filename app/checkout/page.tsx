import type { Metadata } from "next";

import { CheckoutClient } from "@/components/checkout/checkout-client";
import { buildPrivatePageMetadata } from "@/lib/seo";

export const metadata: Metadata = buildPrivatePageMetadata(
  "Checkout",
  "Secure checkout for verified Creatorstack customers."
);

export default function CheckoutPage() {
  return <CheckoutClient />;
}
