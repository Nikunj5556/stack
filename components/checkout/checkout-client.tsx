"use client";

import { useState } from "react";

import { VerificationFlow } from "@/components/auth/verification-flow";
import { useAuth } from "@/hooks/use-auth";
import { useCart } from "@/hooks/use-cart";
import { createMetaEventId, trackMetaBrowserEvent, trackMetaEvent, waitForMetaDispatch } from "@/lib/meta/browser";
import { ensureRazorpay } from "@/lib/razorpay-browser";
import { formatCurrency, safeJson } from "@/lib/utils";

interface CheckoutResponse {
  mode: "wallet_only" | "razorpay";
  checkoutSessionId: string;
  razorpayOrder?: { id: string; amount: number; currency: string };
  purchase: {
    eventId: string;
    value: number;
    currency: string;
  };
}

export function CheckoutClient() {
  const { items, subtotal, clear, updateQuantity, removeItem } = useCart();
  const { customer } = useAuth();
  const [couponCode, setCouponCode] = useState("");
  const [giftCardCode, setGiftCardCode] = useState("");
  const [notes, setNotes] = useState("");
  const [useWallet, setUseWallet] = useState(true);
  const [status, setStatus] = useState("Review your items, apply savings, and finish checkout securely.");
  const [pending, setPending] = useState(false);

  async function startCheckout() {
    if (!items.length) {
      setStatus("Your cart is empty.");
      return;
    }

    if (!customer?.customer.email_verified || !customer?.customer.phone_verified) {
      setStatus("Verify both your email and WhatsApp number before continuing to payment.");
      return;
    }

    setPending(true);
    try {
      const purchaseEventId = createMetaEventId("purchase");
      const eventSourceUrl = typeof window !== "undefined" ? window.location.href : undefined;

      const payload = await safeJson<CheckoutResponse>(
        await fetch("/api/checkout/initiate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            items: items.map((item) => ({
              productId: item.productId,
              variantId: item.variantId ?? null,
              quantity: item.quantity
            })),
            couponCode: couponCode || null,
            giftCardCode: giftCardCode || null,
            useWallet,
            notes: notes || null,
            tracking: {
              purchaseEventId,
              eventSourceUrl
            }
          })
        })
      );

      if (payload.mode === "wallet_only") {
        trackMetaBrowserEvent({
          eventName: "Purchase",
          eventId: payload.purchase.eventId,
          customData: {
            value: payload.purchase.value,
            currency: payload.purchase.currency
          }
        });
        await waitForMetaDispatch();
        clear();
        setStatus("Your order is complete.");
        window.location.href = "/downloads";
        return;
      }

      await ensureRazorpay();

      const Razorpay = window.Razorpay;
      if (!Razorpay || !payload.razorpayOrder) {
        throw new Error("Payment is temporarily unavailable. Please try again in a moment.");
      }

      trackMetaEvent({
        eventName: "AddPaymentInfo",
        eventId: createMetaEventId("add-payment-info"),
        eventSourceUrl,
        customer: {
          email: customer?.customer.email || null,
          phone: customer?.customer.phone || null,
          firstName: customer?.customer.first_name || null
        }
      });

      const checkout = new Razorpay({
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: payload.razorpayOrder.amount,
        currency: payload.razorpayOrder.currency,
        order_id: payload.razorpayOrder.id,
        name: "Creatorstack",
        description: "Digital product checkout",
        prefill: {
          name: customer?.customer.full_name || "",
          email: customer?.customer.email || "",
          contact: customer?.customer.phone || ""
        },
        handler: async (response: Record<string, string>) => {
          await safeJson(
            await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                checkoutSessionId: payload.checkoutSessionId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                purchaseEventId: payload.purchase.eventId,
                eventSourceUrl
              })
            })
          );

          trackMetaBrowserEvent({
            eventName: "Purchase",
            eventId: payload.purchase.eventId,
            customData: {
              value: payload.purchase.value,
              currency: payload.purchase.currency
            }
          });
          await waitForMetaDispatch();
          clear();
          window.location.href = "/downloads";
        }
      });

      checkout.open();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to continue checkout.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-shell page-stack">
      <section className="checkout-card">
        <p className="eyebrow">Checkout</p>
        <h1>Fast, secure checkout for your digital order.</h1>
        <p className="muted">{status}</p>
      </section>

      {!customer?.customer.email_verified || !customer?.customer.phone_verified ? (
        <VerificationFlow
          description="Use your account for a faster checkout, or verify your guest email and WhatsApp number in two short steps."
          eyebrow="Secure checkout"
          purpose="guest_checkout"
          title="Finish the missing verification step before payment."
        />
      ) : null}

      <div className="checkout-layout">
        <section className="checkout-card">
          <h2>Cart items</h2>
          <div className="checkout-lines">
            {items.length ? (
              items.map((item) => (
                <article className="checkout-line" key={`${item.productId}-${item.variantId || "base"}`}>
                  <div>
                    <strong>{item.name}</strong>
                    <p className="muted">{formatCurrency(item.price)} each</p>
                  </div>
                  <div className="quantity-row">
                    <button onClick={() => updateQuantity(item.productId, item.quantity - 1, item.variantId)} type="button">
                      -
                    </button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.productId, item.quantity + 1, item.variantId)} type="button">
                      +
                    </button>
                    <button onClick={() => removeItem(item.productId, item.variantId)} type="button">
                      Remove
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="empty-panel">Your cart is empty. Add a product from the catalog to begin checkout.</div>
            )}
          </div>
        </section>

        <section className="checkout-card">
          <h2>Order settings</h2>
          <div className="form-stack">
            <label className="field">
              <span>Coupon code</span>
              <input onChange={(event) => setCouponCode(event.target.value)} value={couponCode} />
            </label>
            <label className="field">
              <span>Gift card code</span>
              <input onChange={(event) => setGiftCardCode(event.target.value)} value={giftCardCode} />
            </label>
            <label className="field">
              <span>Notes</span>
              <textarea onChange={(event) => setNotes(event.target.value)} rows={4} value={notes} />
            </label>
            <label className="toggle-row">
              <input checked={useWallet} onChange={(event) => setUseWallet(event.target.checked)} type="checkbox" />
              <span>Use my wallet balance first</span>
            </label>
          </div>

          <div className="summary-card">
            <div>
              <span>Cart subtotal</span>
              <strong>{formatCurrency(subtotal)}</strong>
            </div>
            <p className="muted">
              Final totals, discounts, gift cards, and wallet balance are checked securely before payment.
            </p>
          </div>

          <button className="button" disabled={pending || !items.length} onClick={startCheckout} type="button">
            {pending
              ? "Preparing checkout..."
              : customer?.customer.email_verified && customer?.customer.phone_verified
                ? "Continue to payment"
                : "Verify your details to continue"}
          </button>
        </section>
      </div>
    </div>
  );
}
