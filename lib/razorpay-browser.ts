"use client";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open: () => void;
    };
  }
}

let loaded = false;

export async function ensureRazorpay() {
  if (loaded && window.Razorpay) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector('script[data-razorpay="true"]');

    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpay = "true";
    script.onload = () => {
      loaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error("Failed to load Razorpay Checkout"));
    document.body.appendChild(script);
  });
}
