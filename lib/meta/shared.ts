export const META_EVENT_NAMES = [
  "ViewContent",
  "AddToCart",
  "InitiateCheckout",
  "AddPaymentInfo",
  "Purchase"
] as const;

export type MetaEventName = (typeof META_EVENT_NAMES)[number];

export interface MetaCustomerInput {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  country?: string | null;
}

export interface MetaCustomData {
  currency?: string | null;
  value?: number | null;
}

export interface MetaEventInput {
  eventName: MetaEventName;
  eventId: string;
  eventSourceUrl?: string | null;
  actionSource?: "website";
  customer?: MetaCustomerInput | null;
  customData?: MetaCustomData | null;
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function normalizePhone(value?: string | null) {
  const normalized = value?.replace(/\D+/g, "");
  return normalized || null;
}

export function normalizeName(value?: string | null) {
  const normalized = value
    ?.trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\s]/gu, "")
    .replace(/\s+/g, " ");

  return normalized || null;
}

export function normalizeCountry(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function sanitizeEventSourceUrl(value?: string | null) {
  const normalized = value?.trim();
  return normalized || null;
}
