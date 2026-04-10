"use client";

import { useState } from "react";

import { ensureRazorpay } from "@/lib/razorpay-browser";
import { formatCurrency, safeJson } from "@/lib/utils";

export function WalletPanel({ initialBalance }: { initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);
  const [amount, setAmount] = useState("1000");
  const [status, setStatus] = useState("Add money to your wallet for faster checkout. Single top-up limit: INR 10,000.");

  return (
    <section className="wallet-card">
      <p className="eyebrow">Wallet</p>
      <h1>{formatCurrency(balance)}</h1>
      <p className="muted">{status}</p>

      <div className="form-stack">
        <label className="field">
          <span>Amount to add</span>
          <input
            max={10000}
            min={1}
            onChange={(event) => setAmount(event.target.value)}
            type="number"
            value={amount}
          />
        </label>
      </div>

      <button
        className="button"
        onClick={async () => {
          try {
            const parsedAmount = Number(amount);
            const payload = await safeJson<{
              razorpayOrder: { id: string; amount: number; currency: string };
            }>(
              await fetch("/api/wallet/topup/order", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json"
                },
                body: JSON.stringify({ amount: parsedAmount })
              })
            );

            await ensureRazorpay();

            const Razorpay = window.Razorpay;
            if (!Razorpay) {
              throw new Error("Checkout is temporarily unavailable.");
            }

            const checkout = new Razorpay({
              key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
              amount: payload.razorpayOrder.amount,
              currency: payload.razorpayOrder.currency,
              order_id: payload.razorpayOrder.id,
              name: "Creatorstack Wallet",
              description: "Add money to wallet",
              handler: async (response: Record<string, string>) => {
                const verified = await safeJson<{ walletBalance: number }>(
                  await fetch("/api/wallet/topup/verify", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      razorpayOrderId: response.razorpay_order_id,
                      razorpayPaymentId: response.razorpay_payment_id,
                      razorpaySignature: response.razorpay_signature
                    })
                  })
                );
                setBalance(verified.walletBalance);
                setStatus("Money added successfully to your wallet.");
              }
            });

            checkout.open();
          } catch (error) {
            setStatus(error instanceof Error ? error.message : "Unable to start your wallet top-up.");
          }
        }}
        type="button"
      >
        Add money
      </button>
    </section>
  );
}
