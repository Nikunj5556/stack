const crypto = require("node:crypto");
const express = require("express");

const router = express.Router();

const META_DATASET_ID = process.env.META_DATASET_ID;
const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v25.0";

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(value) {
  return value ? value.trim().toLowerCase() : null;
}

function normalizePhone(value) {
  return value ? value.replace(/\D+/g, "") : null;
}

function normalizeFirstName(value) {
  return value ? value.trim().toLowerCase().replace(/[^a-z\s]/g, "").replace(/\s+/g, " ") : null;
}

function normalizeCountry(value) {
  return value ? value.trim().toLowerCase() : null;
}

async function sendMetaEvent({ eventName, eventId, eventSourceUrl, customData, customer, clientIpAddress, clientUserAgent }) {
  if (!META_ACCESS_TOKEN || !(META_DATASET_ID || META_PIXEL_ID)) {
    return;
  }

  const response = await fetch(
    `https://graph.facebook.com/${META_GRAPH_API_VERSION}/${META_DATASET_ID || META_PIXEL_ID}/events?access_token=${encodeURIComponent(META_ACCESS_TOKEN)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        data: [
          {
            event_name: eventName,
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: eventSourceUrl,
            action_source: "website",
            event_id: eventId,
            user_data: {
              client_ip_address: clientIpAddress,
              client_user_agent: clientUserAgent,
              ...(customer?.email ? { em: sha256(normalizeEmail(customer.email)) } : {}),
              ...(customer?.phone ? { ph: sha256(normalizePhone(customer.phone)) } : {}),
              ...(customer?.firstName ? { fn: sha256(normalizeFirstName(customer.firstName)) } : {}),
              ...(customer?.country ? { country: sha256(normalizeCountry(customer.country)) } : {})
            },
            ...(customData ? { custom_data: customData } : {})
          }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Meta event failed with ${response.status}`);
  }
}

router.post("/meta/events", async (req, res) => {
  try {
    await sendMetaEvent({
      eventName: req.body.eventName,
      eventId: req.body.eventId,
      eventSourceUrl: req.body.eventSourceUrl,
      customData: req.body.customData,
      customer: req.body.customer,
      clientIpAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || null,
      clientUserAgent: req.get("user-agent") || null
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Meta event failed" });
  }
});

module.exports = router;
