import { clsx } from "clsx";

export function cn(...inputs: Array<string | false | null | undefined>) {
  return clsx(inputs);
}

export function formatCurrency(value: number | string, currency = "INR") {
  const amount = typeof value === "string" ? Number(value) : value;

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = typeof value === "string" ? new Date(value) : value;

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function toMinorUnits(amount: number) {
  return Math.round(amount * 100);
}

export function fromMinorUnits(amount: number) {
  return amount / 100;
}

export async function safeJson<T>(response: Response): Promise<T> {
  const body = await response.json();

  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : "Request failed";
    throw new Error(message);
  }

  return body as T;
}
