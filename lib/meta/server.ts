import { createHash } from "node:crypto";

import { env } from "@/lib/env";
import {
  normalizeCountry,
  normalizeEmail,
  normalizeName,
  normalizePhone,
  sanitizeEventSourceUrl,
  type MetaEventInput
} from "@/lib/meta/shared";

interface ServerMetaEventInput extends MetaEventInput {
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== null && entry !== undefined)) as T;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function hashValue(value?: string | null) {
  return value ? sha256(value) : null;
}

function buildUserData(input: ServerMetaEventInput) {
  return compact({
    client_ip_address: input.clientIpAddress || undefined,
    client_user_agent: input.clientUserAgent || undefined,
    em: hashValue(normalizeEmail(input.customer?.email)),
    ph: hashValue(normalizePhone(input.customer?.phone)),
    fn: hashValue(normalizeName(input.customer?.firstName)),
    country: hashValue(normalizeCountry(input.customer?.country))
  });
}

function buildCustomData(input: ServerMetaEventInput) {
  return compact({
    currency: input.customData?.currency?.trim().toUpperCase() || undefined,
    value: typeof input.customData?.value === "number" ? input.customData.value : undefined
  });
}

function buildEventPayload(input: ServerMetaEventInput) {
  const eventPayload = compact({
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: sanitizeEventSourceUrl(input.eventSourceUrl) || undefined,
    action_source: input.actionSource || "website",
    event_id: input.eventId,
    user_data: buildUserData(input)
  });

  const customData = buildCustomData(input);
  if (Object.keys(customData).length) {
    return {
      ...eventPayload,
      custom_data: customData
    };
  }

  return eventPayload;
}

export function getRequestClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || null;
  }

  return headers.get("x-real-ip") || headers.get("cf-connecting-ip") || null;
}

export function getRequestUserAgent(headers: Headers) {
  return headers.get("user-agent") || null;
}

export async function sendMetaConversionEvent(input: ServerMetaEventInput) {
  if (!env.isMetaConfigured) {
    return { ok: false, skipped: true as const };
  }

  const datasetOrPixelId = env.metaDatasetId || env.metaPixelId;
  if (!datasetOrPixelId) {
    return { ok: false, skipped: true as const };
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/${env.metaGraphApiVersion}/${datasetOrPixelId}/events?access_token=${encodeURIComponent(env.metaAccessToken)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          data: [buildEventPayload(input)]
        })
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Meta Conversions API request failed", response.status, details);
      return { ok: false, status: response.status };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    console.error("Meta Conversions API request errored", error);
    return { ok: false, error: error instanceof Error ? error.message : "Unknown Meta error" };
  }
}
