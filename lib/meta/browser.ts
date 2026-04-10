"use client";

import type { MetaCustomerInput, MetaCustomData, MetaEventInput, MetaEventName } from "@/lib/meta/shared";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

interface BrowserMetaEventInput {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl?: string | null;
  customer?: MetaCustomerInput | null;
  customData?: MetaCustomData | null;
}

const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

function browserHasPixel() {
  return Boolean(pixelId && typeof window !== "undefined" && typeof window.fbq === "function");
}

function getPixelCustomData(customData?: MetaCustomData | null) {
  const payload: Record<string, string | number> = {};

  if (customData?.currency) {
    payload.currency = customData.currency.toUpperCase();
  }

  if (typeof customData?.value === "number") {
    payload.value = customData.value;
  }

  return payload;
}

export function createMetaEventId(prefix = "meta") {
  const randomId =
    typeof window !== "undefined" && window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${randomId}`;
}

export function trackMetaBrowserEvent({ eventName, eventId, customData }: BrowserMetaEventInput) {
  if (!browserHasPixel()) {
    return;
  }

  const payload = getPixelCustomData(customData);
  window.fbq?.("track", eventName, payload, { eventID: eventId });
}

export async function sendMetaServerEvent({
  eventName,
  eventId,
  eventSourceUrl,
  customer,
  customData
}: BrowserMetaEventInput) {
  const body: MetaEventInput = {
    eventName,
    eventId,
    eventSourceUrl,
    customer,
    customData
  };

  try {
    await fetch("/api/meta/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      keepalive: true
    });
  } catch {
    // Tracking should never interrupt the storefront flow.
  }
}

export function trackMetaEvent(input: BrowserMetaEventInput) {
  trackMetaBrowserEvent(input);
  void sendMetaServerEvent(input);
}

export async function waitForMetaDispatch(delayMs = 120) {
  if (typeof window === "undefined") {
    return;
  }

  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), delayMs);
  });
}
