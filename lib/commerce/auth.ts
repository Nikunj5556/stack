import { cookies } from "next/headers";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

import type { CustomerSyncResponse } from "@/lib/auth/shared";
import { env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Customer, Order, UserIdentity, Wallet } from "@/lib/supabase/types";

const SESSION_COOKIE = "creatorstack_session";
const OTP_EXPIRY_MINUTES = 10;
const SESSION_LIFETIME_DAYS = 30;

type OtpChannel = "email" | "whatsapp";
type AuthPurpose = "account_access" | "guest_checkout";
type CustomerAuthMethod = "email_otp" | "whatsapp_otp" | "google_oauth" | "github_oauth";
type OAuthProvider = "google" | "github";

interface RequestContext {
  ipAddress?: string | null;
  userAgent?: string | null;
}

interface RequestOtpInput {
  fullName?: string | null;
  email: string;
  phone: string;
  channel: OtpChannel;
  purpose: AuthPurpose;
  requestContext?: RequestContext;
}

interface VerifyOtpInput extends RequestOtpInput {
  otp: string;
}

interface StartEmailPasswordAccessInput {
  email: string;
  password: string;
  requestContext?: RequestContext;
}

interface VerifyEmailPasswordAccessInput {
  email: string;
  otp: string;
  requestContext?: RequestContext;
}

interface CustomerSessionRow {
  id: string;
  customer_id: string;
  auth_method: CustomerAuthMethod;
  expires_at: string;
}

interface CustomerOtpChallengeRow {
  id: string;
  customer_id: string | null;
  otp_hash: string;
  attempts: number;
  max_attempts: number;
  expires_at: string;
  metadata?: Record<string, unknown> | null;
}

interface SessionCustomerBundle {
  customer: Customer;
  wallet: Wallet;
  session: CustomerSessionRow;
}

export interface CustomerSyncSnapshot extends CustomerSyncResponse {}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizePhone(value: string) {
  return value.replace(/[^\d]/g, "");
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  return value.trim().startsWith("+") ? `+${digits}` : digits;
}

function validatePassword(value: string) {
  const trimmed = value.trim();
  if (trimmed.length < 8) {
    throw new Error("Use a password with at least 8 characters.");
  }

  return trimmed;
}

function hashPassword(value: string) {
  const salt = randomBytes(16);
  const derived = scryptSync(value, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

function verifyPasswordHash(password: string, storedHash?: string | null) {
  if (!storedHash?.startsWith("scrypt$")) {
    return false;
  }

  const [, saltHex, digestHex] = storedHash.split("$");
  if (!saltHex || !digestHex) {
    return false;
  }

  const computedDigest = scryptSync(password, Buffer.from(saltHex, "hex"), Buffer.from(digestHex, "hex").length);
  const expectedDigest = Buffer.from(digestHex, "hex");

  return computedDigest.length === expectedDigest.length && timingSafeEqual(computedDigest, expectedDigest);
}

function splitName(fullName?: string | null) {
  if (!fullName?.trim()) {
    return { firstName: null, lastName: null, fullName: null };
  }

  const parts = fullName.trim().split(/\s+/);
  const [firstName, ...rest] = parts;

  return {
    firstName: firstName || null,
    lastName: rest.join(" ") || null,
    fullName: parts.join(" ")
  };
}

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!local || !domain) {
    return value;
  }

  return `${local.slice(0, 2)}${"*".repeat(Math.max(local.length - 2, 2))}@${domain}`;
}

function maskPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length <= 4) {
    return digits;
  }

  return `${digits.slice(0, 2)}${"*".repeat(Math.max(digits.length - 4, 2))}${digits.slice(-2)}`;
}

function getWindowStart(windowMinutes: number) {
  const windowMs = windowMinutes * 60 * 1000;
  return new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();
}

function dedupeCustomers(customers: Array<Customer | null | undefined>) {
  const map = new Map<string, Customer>();
  for (const customer of customers) {
    if (customer?.id) {
      map.set(customer.id, customer);
    }
  }
  return [...map.values()];
}

function sortCustomersForPrimary(customers: Customer[], preferredId?: string | null) {
  return [...customers].sort((left, right) => {
    if (preferredId && left.id === preferredId) {
      return -1;
    }

    if (preferredId && right.id === preferredId) {
      return 1;
    }

    const leftScore = Number(left.email_verified) + Number(left.phone_verified);
    const rightScore = Number(right.email_verified) + Number(right.phone_verified);
    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  });
}

function getProviderEmail(user: SupabaseAuthUser) {
  const rawEmail =
    user.email ||
    ((user.user_metadata?.email as string | undefined) ?? null) ||
    ((user.identities ?? []).find((identity) => identity.identity_data?.email)?.identity_data?.email as string | undefined) ||
    null;

  return rawEmail ? normalizeEmail(rawEmail) : null;
}

function getProviderFullName(user: SupabaseAuthUser) {
  const metadata = user.user_metadata ?? {};
  const first = (metadata.given_name as string | undefined) ?? null;
  const last = (metadata.family_name as string | undefined) ?? null;
  const fallbackName = [first, last].filter(Boolean).join(" ") || null;
  const full =
    (metadata.full_name as string | undefined) ??
    (metadata.name as string | undefined) ??
    fallbackName;

  return splitName(full);
}

function getProviderAvatar(user: SupabaseAuthUser) {
  const metadata = user.user_metadata ?? {};
  return (
    (metadata.avatar_url as string | undefined) ??
    (metadata.picture as string | undefined) ??
    (metadata.image as string | undefined) ??
    null
  );
}

function getProviderIdentity(user: SupabaseAuthUser, provider: OAuthProvider) {
  const identity = (user.identities ?? []).find((entry) => entry.provider === provider);
  if (!identity) {
    return null;
  }

  return {
    providerUserId:
      identity.user_id ||
      identity.id ||
      (identity.identity_data?.sub as string | undefined) ||
      (identity.identity_data?.user_id as string | undefined) ||
      user.id,
    providerData: identity.identity_data ?? {}
  };
}

function authMethodForProvider(provider: OAuthProvider): CustomerAuthMethod {
  return provider === "google" ? "google_oauth" : "github_oauth";
}

const smtpTransport =
  env.isSmtpConfigured
    ? nodemailer.createTransport({
        host: env.smtpHost,
        port: env.smtpPort,
        secure: env.smtpSecure,
        auth: {
          user: env.smtpUser,
          pass: env.smtpPass
        }
      })
    : null;

async function sendEmailOtp(email: string, code: string, fullName?: string | null) {
  if (!smtpTransport) {
    throw new Error("Email verification is not configured yet.");
  }

  const greeting = fullName?.trim() ? `Hi ${fullName.trim()},` : "Hi,";

  await smtpTransport.sendMail({
    from: `${env.smtpFromName} <${env.smtpFromEmail}>`,
    to: email,
    subject: `${env.appName} verification code`,
    text: `${greeting}\n\nYour ${env.appName} verification code is ${code}. It expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you did not request this code, you can ignore this message.`,
    html: `<p>${greeting}</p><p>Your <strong>${env.appName}</strong> verification code is:</p><p style="font-size:32px;font-weight:700;letter-spacing:6px;">${code}</p><p>This code expires in ${OTP_EXPIRY_MINUTES} minutes.</p><p>If you did not request this code, you can safely ignore this email.</p>`
  });
}

async function sendWhatsAppOtp(phone: string, code: string) {
  if (!env.isWhatsAppConfigured) {
    throw new Error("WhatsApp verification is not configured yet.");
  }

  const response = await fetch(
    `https://graph.facebook.com/${env.metaGraphApiVersion}/${env.whatsappPhoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.whatsappAccessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: phone,
        type: "template",
        template: {
          name: env.whatsappTemplateName,
          language: {
            code: env.whatsappTemplateLanguage
          },
          components: [
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  text: code
                }
              ]
            }
          ]
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error("WhatsApp verification could not be sent right now.");
  }
}

async function enforceRateLimit(args: {
  action: string;
  bucketKey: string;
  limit: number;
  windowMinutes: number;
  message: string;
}) {
  const windowStartsAt = getWindowStart(args.windowMinutes);
  const { data: existing, error } = await supabaseAdmin
    .from("auth_rate_limits")
    .select("*")
    .eq("action", args.action)
    .eq("bucket_key", args.bucketKey)
    .eq("window_starts_at", windowStartsAt)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!existing) {
    const { error: insertError } = await supabaseAdmin.from("auth_rate_limits").insert({
      action: args.action,
      bucket_key: args.bucketKey,
      window_starts_at: windowStartsAt,
      hit_count: 1
    });

    if (insertError) {
      throw new Error(insertError.message);
    }

    return;
  }

  if (Number(existing.hit_count) >= args.limit) {
    throw new Error(args.message);
  }

  const { error: updateError } = await supabaseAdmin
    .from("auth_rate_limits")
    .update({
      hit_count: Number(existing.hit_count) + 1,
      updated_at: new Date().toISOString()
    })
    .eq("id", existing.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function upsertCustomerAuthIdentity(
  customerId: string,
  provider: "email" | "phone",
  providerValue: string,
  normalizedValue: string
) {
  const { error } = await supabaseAdmin.from("customer_auth_identities").upsert(
    {
      customer_id: customerId,
      provider,
      provider_value: providerValue,
      normalized_value: normalizedValue,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      onConflict: "provider,normalized_value"
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function upsertUserIdentity(args: {
  customerId: string;
  provider: string;
  providerUserId: string;
  email?: string | null;
  avatarUrl?: string | null;
  providerData?: Record<string, unknown>;
}) {
  const { error } = await supabaseAdmin.from("user_identities").upsert(
    {
      customer_id: args.customerId,
      provider: args.provider,
      provider_user_id: args.providerUserId,
      email: args.email ?? null,
      avatar_url: args.avatarUrl ?? null,
      provider_data: args.providerData ?? {},
      linked_at: new Date().toISOString()
    },
    {
      onConflict: "customer_id,provider"
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

async function getLinkedProviders(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_identities")
    .select("*")
    .eq("customer_id", customerId)
    .order("linked_at", { ascending: true });

  if (error) {
    if (error.message.toLowerCase().includes("user_identities")) {
      return [] as UserIdentity[];
    }

    throw new Error(error.message);
  }

  return (data ?? []) as UserIdentity[];
}

async function ensureWallet(customerId: string) {
  const { data, error } = await supabaseAdmin
    .from("wallets")
    .upsert({ customer_id: customerId }, { onConflict: "customer_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Wallet;
}

async function claimGuestRecords(customer: Customer) {
  const orderFilters = [
    customer.email ? `email_snapshot.eq.${customer.email}` : null,
    customer.phone ? `phone_snapshot.eq.${customer.phone}` : null
  ].filter(Boolean);
  const checkoutFilters = [
    customer.email ? `guest_email.eq.${customer.email}` : null,
    customer.phone ? `guest_phone.eq.${customer.phone}` : null
  ].filter(Boolean);
  const ticketFilters = [
    customer.email ? `guest_email.eq.${customer.email}` : null,
    customer.phone ? `guest_phone.eq.${customer.phone}` : null
  ].filter(Boolean);

  const [{ data: guestOrders }, { data: guestCheckouts }, { data: guestTickets }] = await Promise.all([
    orderFilters.length
      ? supabaseAdmin.from("orders").select("id").is("customer_id", null).or(orderFilters.join(","))
      : Promise.resolve({ data: [] }),
    checkoutFilters.length
      ? supabaseAdmin.from("checkout_sessions").select("id").is("customer_id", null).or(checkoutFilters.join(","))
      : Promise.resolve({ data: [] }),
    ticketFilters.length
      ? supabaseAdmin.from("support_tickets").select("id").is("customer_id", null).or(ticketFilters.join(","))
      : Promise.resolve({ data: [] })
  ]);

  const orderIds = (guestOrders ?? []).map((entry) => entry.id as string);
  const checkoutIds = (guestCheckouts ?? []).map((entry) => entry.id as string);
  const ticketIds = (guestTickets ?? []).map((entry) => entry.id as string);

  await Promise.all([
    orderIds.length
      ? supabaseAdmin.from("orders").update({ customer_id: customer.id }).in("id", orderIds)
      : Promise.resolve(),
    orderIds.length
      ? supabaseAdmin.from("payments").update({ customer_id: customer.id }).in("order_id", orderIds)
      : Promise.resolve(),
    orderIds.length
      ? supabaseAdmin.from("access_grants").update({ customer_id: customer.id }).in("order_id", orderIds)
      : Promise.resolve(),
    checkoutIds.length
      ? supabaseAdmin.from("checkout_sessions").update({ customer_id: customer.id }).in("id", checkoutIds)
      : Promise.resolve(),
    ticketIds.length
      ? supabaseAdmin.from("support_tickets").update({ customer_id: customer.id }).in("id", ticketIds)
      : Promise.resolve()
  ]);
}

async function createSession(customerId: string, authMethod: CustomerAuthMethod) {
  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("customer_sessions").insert({
    customer_id: customerId,
    token_hash: sha256(rawToken),
    auth_method: authMethod,
    expires_at: expiresAt
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    token: rawToken,
    expiresAt
  };
}

async function touchSession(sessionId: string) {
  await supabaseAdmin
    .from("customer_sessions")
    .update({
      last_seen_at: new Date().toISOString()
    })
    .eq("id", sessionId);
}

async function mergeCustomers(primaryCustomer: Customer, secondaryCustomer: Customer) {
  if (primaryCustomer.id === secondaryCustomer.id) {
    return primaryCustomer;
  }

  const [{ data: primaryReviews }, { data: secondaryReviews }, primaryWallet, secondaryWalletResult] = await Promise.all([
    supabaseAdmin.from("product_reviews").select("id, product_id, is_verified_purchase").eq("customer_id", primaryCustomer.id),
    supabaseAdmin.from("product_reviews").select("id, product_id, is_verified_purchase").eq("customer_id", secondaryCustomer.id),
    ensureWallet(primaryCustomer.id),
    supabaseAdmin.from("wallets").select("*").eq("customer_id", secondaryCustomer.id).maybeSingle()
  ]);

  const secondaryWallet = (secondaryWalletResult.data ?? null) as Wallet | null;
  const primaryReviewByProduct = new Map((primaryReviews ?? []).map((review) => [review.product_id as string, review]));

  for (const secondaryReview of secondaryReviews ?? []) {
    const existingPrimaryReview = primaryReviewByProduct.get(secondaryReview.product_id as string);

    if (existingPrimaryReview) {
      await Promise.all([
        supabaseAdmin
          .from("product_review_media")
          .update({ review_id: existingPrimaryReview.id })
          .eq("review_id", secondaryReview.id),
        supabaseAdmin
          .from("product_reviews")
          .update({
            is_verified_purchase:
              Boolean(existingPrimaryReview.is_verified_purchase) || Boolean(secondaryReview.is_verified_purchase),
            updated_at: new Date().toISOString()
          })
          .eq("id", existingPrimaryReview.id),
        supabaseAdmin.from("product_reviews").delete().eq("id", secondaryReview.id)
      ]);
    } else {
      await supabaseAdmin
        .from("product_reviews")
        .update({ customer_id: primaryCustomer.id, updated_at: new Date().toISOString() })
        .eq("id", secondaryReview.id);
    }
  }

  await Promise.all([
    supabaseAdmin.from("orders").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("payments").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("access_grants").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("checkout_sessions").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("support_tickets").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("conversations").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("carts").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("customer_addresses").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("wishlists").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("refunds").update({ customer_id: primaryCustomer.id }).eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("customers").update({ referred_by: primaryCustomer.id }).eq("referred_by", secondaryCustomer.id)
  ]);

  const [{ data: secondaryOtpIdentities }, { data: secondaryUserIdentities }] = await Promise.all([
    supabaseAdmin.from("customer_auth_identities").select("*").eq("customer_id", secondaryCustomer.id),
    supabaseAdmin.from("user_identities").select("*").eq("customer_id", secondaryCustomer.id)
  ]);

  for (const identity of secondaryOtpIdentities ?? []) {
    await upsertCustomerAuthIdentity(
      primaryCustomer.id,
      identity.provider as "email" | "phone",
      identity.provider_value as string,
      identity.normalized_value as string
    );
  }

  for (const identity of secondaryUserIdentities ?? []) {
    await upsertUserIdentity({
      customerId: primaryCustomer.id,
      provider: identity.provider as string,
      providerUserId: identity.provider_user_id as string,
      email: (identity.email as string | null) ?? null,
      avatarUrl: (identity.avatar_url as string | null) ?? null,
      providerData: (identity.provider_data as Record<string, unknown>) ?? {}
    });
  }

  if (secondaryWallet) {
    await Promise.all([
      supabaseAdmin
        .from("wallet_transactions")
        .update({ wallet_id: primaryWallet.id })
        .eq("wallet_id", secondaryWallet.id),
      supabaseAdmin
        .from("wallets")
        .update({
          current_balance: Number(primaryWallet.current_balance) + Number(secondaryWallet.current_balance),
          lifetime_credited: Number(primaryWallet.lifetime_credited) + Number(secondaryWallet.lifetime_credited),
          lifetime_debited: Number(primaryWallet.lifetime_debited) + Number(secondaryWallet.lifetime_debited),
          last_updated: new Date().toISOString()
        })
        .eq("id", primaryWallet.id),
      supabaseAdmin.from("wallets").delete().eq("id", secondaryWallet.id)
    ]);
  }

  const mergedPatch = {
    user_id: primaryCustomer.user_id || secondaryCustomer.user_id,
    first_name: primaryCustomer.first_name || secondaryCustomer.first_name,
    last_name: primaryCustomer.last_name || secondaryCustomer.last_name,
    full_name: primaryCustomer.full_name || secondaryCustomer.full_name,
    email: primaryCustomer.email || secondaryCustomer.email,
    email_verified: Boolean(primaryCustomer.email_verified || secondaryCustomer.email_verified),
    phone: primaryCustomer.phone || secondaryCustomer.phone,
    phone_verified: Boolean(primaryCustomer.phone_verified || secondaryCustomer.phone_verified),
    profile_image: primaryCustomer.profile_image || secondaryCustomer.profile_image,
    updated_at: new Date().toISOString()
  };

  const { data: updatedPrimary, error: updatePrimaryError } = await supabaseAdmin
    .from("customers")
    .update(mergedPatch)
    .eq("id", primaryCustomer.id)
    .select("*")
    .single();

  if (updatePrimaryError) {
    throw new Error(updatePrimaryError.message);
  }

  await supabaseAdmin.from("customer_sessions").delete().eq("customer_id", secondaryCustomer.id);
  await supabaseAdmin.from("customers").delete().eq("id", secondaryCustomer.id);

  return updatedPrimary as Customer;
}

async function resolveCustomerByInputs(args: {
  email: string;
  phone: string;
  fullName?: string | null;
  currentCustomerId?: string | null;
}) {
  const normalizedEmail = normalizeEmail(args.email);
  const formattedPhone = formatPhone(args.phone);
  const normalizedPhone = normalizePhone(args.phone);
  const names = splitName(args.fullName);

  const [currentCustomerResult, emailIdentity, phoneIdentity, emailCustomer, phoneCustomer] = await Promise.all([
    args.currentCustomerId
      ? supabaseAdmin.from("customers").select("*").eq("id", args.currentCustomerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from("customer_auth_identities")
      .select("customer_id")
      .eq("provider", "email")
      .eq("normalized_value", normalizedEmail)
      .maybeSingle(),
    supabaseAdmin
      .from("customer_auth_identities")
      .select("customer_id")
      .eq("provider", "phone")
      .eq("normalized_value", normalizedPhone)
      .maybeSingle(),
    supabaseAdmin.from("customers").select("*").ilike("email", normalizedEmail).maybeSingle(),
    supabaseAdmin.from("customers").select("*").eq("phone", formattedPhone).maybeSingle()
  ]);

  const identityCustomerIds = [emailIdentity.data?.customer_id, phoneIdentity.data?.customer_id].filter(Boolean) as string[];
  const { data: identityCustomers, error: identityError } = identityCustomerIds.length
    ? await supabaseAdmin.from("customers").select("*").in("id", [...new Set(identityCustomerIds)])
    : { data: [], error: null };

  if (identityError) {
    throw new Error(identityError.message);
  }

  const currentCustomer = (currentCustomerResult.data ?? null) as Customer | null;
  const matches = sortCustomersForPrimary(
    dedupeCustomers([
      currentCustomer,
      ...(identityCustomers as Customer[]),
      (emailCustomer.data ?? null) as Customer | null,
      (phoneCustomer.data ?? null) as Customer | null
    ]),
    currentCustomer?.id
  );

  let existingCustomer = matches[0];
  if (matches.length > 1 && existingCustomer) {
    for (const duplicateCustomer of matches.slice(1)) {
      existingCustomer = await mergeCustomers(existingCustomer, duplicateCustomer);
    }
  }

  if (existingCustomer) {
    const { data, error } = await supabaseAdmin
      .from("customers")
      .update({
        first_name: existingCustomer.first_name || names.firstName,
        last_name: existingCustomer.last_name || names.lastName,
        full_name: existingCustomer.full_name || names.fullName,
        email: existingCustomer.email || normalizedEmail,
        phone: existingCustomer.phone || formattedPhone,
        updated_at: new Date().toISOString()
      })
      .eq("id", existingCustomer.id)
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data as Customer;
  }

  const { data, error } = await supabaseAdmin
    .from("customers")
    .insert({
      first_name: names.firstName,
      last_name: names.lastName,
      full_name: names.fullName,
      email: normalizedEmail,
      email_verified: false,
      phone: formattedPhone,
      phone_verified: false
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Customer;
}

async function findCustomerByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const [emailIdentityResult, emailCustomerResult] = await Promise.all([
    supabaseAdmin
      .from("customer_auth_identities")
      .select("customer_id")
      .eq("provider", "email")
      .eq("normalized_value", normalizedEmail)
      .maybeSingle(),
    supabaseAdmin.from("customers").select("*").ilike("email", normalizedEmail).maybeSingle()
  ]);

  const customerIds = [emailIdentityResult.data?.customer_id].filter(Boolean) as string[];
  const { data: identityCustomers, error } = customerIds.length
    ? await supabaseAdmin.from("customers").select("*").in("id", [...new Set(customerIds)])
    : { data: [], error: null };

  if (error) {
    throw new Error(error.message);
  }

  const candidates = sortCustomersForPrimary(
    dedupeCustomers([...(identityCustomers as Customer[]), (emailCustomerResult.data ?? null) as Customer | null])
  );

  let customer = candidates[0] ?? null;
  if (candidates.length > 1 && customer) {
    for (const duplicateCustomer of candidates.slice(1)) {
      customer = await mergeCustomers(customer, duplicateCustomer);
    }
  }

  return customer;
}

export async function getCurrentSessionRecord() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("customer_sessions")
    .select("*")
    .eq("token_hash", sha256(token))
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const session = data as CustomerSessionRow;
  if (new Date(session.expires_at) <= new Date()) {
    await supabaseAdmin.from("customer_sessions").delete().eq("id", session.id);
    return null;
  }

  await touchSession(session.id);
  return session;
}

export async function startEmailPasswordAccess(input: StartEmailPasswordAccessInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const password = validatePassword(input.password);
  const existingCustomer = await findCustomerByEmail(normalizedEmail);

  await Promise.all([
    enforceRateLimit({
      action: "email-access-start-email",
      bucketKey: normalizedEmail,
      limit: 8,
      windowMinutes: 60,
      message: "Too many sign-in attempts were made for this email. Please try again a little later."
    }),
    input.requestContext?.ipAddress
      ? enforceRateLimit({
          action: "email-access-start-ip",
          bucketKey: input.requestContext.ipAddress,
          limit: 20,
          windowMinutes: 60,
          message: "Too many account attempts were made from this connection. Please try again later."
        })
      : Promise.resolve()
  ]);

  if (existingCustomer?.password_hash && existingCustomer.email_verified) {
    if (!verifyPasswordHash(password, existingCustomer.password_hash)) {
      throw new Error("Incorrect email or password.");
    }

    await claimGuestRecords(existingCustomer);
    const wallet = await ensureWallet(existingCustomer.id);
    const createdSession = await createSession(existingCustomer.id, "email_otp");

    return {
      mode: "signed_in" as const,
      message: "Welcome back. You are signed in.",
      snapshot: await buildSyncSnapshot(existingCustomer, wallet, {
        id: "",
        customer_id: existingCustomer.id,
        auth_method: "email_otp",
        expires_at: createdSession.expiresAt
      }),
      sessionToken: createdSession.token,
      sessionExpiresAt: createdSession.expiresAt
    };
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();
  const passwordHash = existingCustomer?.password_hash || hashPassword(password);

  const { error } = await supabaseAdmin.from("customer_otp_challenges").insert({
    customer_id: existingCustomer?.id ?? null,
    purpose: "account_access",
    channel: "email",
    target: normalizedEmail,
    target_normalized: normalizedEmail,
    otp_hash: sha256(code),
    requested_ip: input.requestContext?.ipAddress ?? null,
    requested_user_agent: input.requestContext?.userAgent ?? null,
    metadata: {
      email: normalizedEmail,
      password_hash: passwordHash
    },
    expires_at: expiresAt
  });

  if (error) {
    throw new Error(error.message);
  }

  await sendEmailOtp(normalizedEmail, code, existingCustomer?.full_name);

  return {
    mode: "otp_required" as const,
    message: `We sent a sign-in code to ${maskEmail(normalizedEmail)}.`,
    email: normalizedEmail
  };
}

export async function verifyEmailPasswordAccess(input: VerifyEmailPasswordAccessInput) {
  const normalizedEmail = normalizeEmail(input.email);

  await Promise.all([
    enforceRateLimit({
      action: "email-access-verify-email",
      bucketKey: normalizedEmail,
      limit: 8,
      windowMinutes: 15,
      message: "Too many incorrect codes were entered. Please request a new code."
    }),
    input.requestContext?.ipAddress
      ? enforceRateLimit({
          action: "email-access-verify-ip",
          bucketKey: input.requestContext.ipAddress,
          limit: 20,
          windowMinutes: 60,
          message: "Too many verification attempts were made from this connection. Please try again later."
        })
      : Promise.resolve()
  ]);

  const { data, error } = await supabaseAdmin
    .from("customer_otp_challenges")
    .select("*")
    .eq("purpose", "account_access")
    .eq("channel", "email")
    .eq("target_normalized", normalizedEmail)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Request a fresh email code and try again.");
  }

  const challenge = data as CustomerOtpChallengeRow;
  if (new Date(challenge.expires_at) <= new Date()) {
    throw new Error("This email code has expired. Request a new code to continue.");
  }

  if (challenge.attempts >= challenge.max_attempts) {
    throw new Error("Too many incorrect attempts. Request a new code to continue.");
  }

  if (!compareOtp(input.otp.trim(), challenge.otp_hash)) {
    await supabaseAdmin
      .from("customer_otp_challenges")
      .update({
        attempts: challenge.attempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", challenge.id);

    throw new Error("That code did not match. Please check it and try again.");
  }

  const passwordHash = typeof challenge.metadata?.password_hash === "string" ? challenge.metadata.password_hash : null;
  let customer =
    (challenge.customer_id
      ? ((await supabaseAdmin.from("customers").select("*").eq("id", challenge.customer_id).maybeSingle()).data as Customer | null)
      : null) ?? (await findCustomerByEmail(normalizedEmail));

  if (!customer) {
    const { data: insertedCustomer, error: insertError } = await supabaseAdmin
      .from("customers")
      .insert({
        email: normalizedEmail,
        email_verified: true,
        password_hash: passwordHash
      })
      .select("*")
      .single();

    if (insertError) {
      throw new Error(insertError.message);
    }

    customer = insertedCustomer as Customer;
  } else {
    const { data: updatedCustomer, error: updateError } = await supabaseAdmin
      .from("customers")
      .update({
        email: normalizedEmail,
        email_verified: true,
        password_hash: customer.password_hash || passwordHash,
        updated_at: new Date().toISOString()
      })
      .eq("id", customer.id)
      .select("*")
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    customer = updatedCustomer as Customer;
  }

  await Promise.all([
    upsertCustomerAuthIdentity(customer.id, "email", normalizedEmail, normalizedEmail),
    upsertUserIdentity({
      customerId: customer.id,
      provider: "email",
      providerUserId: normalizedEmail,
      email: normalizedEmail,
      providerData: {
        verified: true
      }
    }),
    supabaseAdmin
      .from("customer_otp_challenges")
      .update({
        verified_at: new Date().toISOString(),
        consumed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", challenge.id)
  ]);

  await claimGuestRecords(customer);
  const wallet = await ensureWallet(customer.id);
  const createdSession = await createSession(customer.id, "email_otp");

  return {
    snapshot: await buildSyncSnapshot(customer, wallet, {
      id: "",
      customer_id: customer.id,
      auth_method: "email_otp",
      expires_at: createdSession.expiresAt
    }),
    sessionToken: createdSession.token,
    sessionExpiresAt: createdSession.expiresAt
  };
}

export async function requestOtp(input: RequestOtpInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const formattedPhone = formatPhone(input.phone);
  const target = input.channel === "email" ? normalizedEmail : formattedPhone;
  const targetNormalized = input.channel === "email" ? normalizedEmail : normalizedPhone;
  const session = await getCurrentSessionRecord();

  await Promise.all([
    enforceRateLimit({
      action: "otp-send-target",
      bucketKey: `${input.channel}:${targetNormalized}`,
      limit: 3,
      windowMinutes: 15,
      message: "Too many codes were sent to this contact. Please wait a few minutes and try again."
    }),
    input.requestContext?.ipAddress
      ? enforceRateLimit({
          action: "otp-send-ip",
          bucketKey: input.requestContext.ipAddress,
          limit: 10,
          windowMinutes: 60,
          message: "Too many verification requests were made from this connection. Please try again later."
        })
      : Promise.resolve()
  ]);

  const customer = await resolveCustomerByInputs({
    email: normalizedEmail,
    phone: formattedPhone,
    fullName: input.fullName,
    currentCustomerId: session?.customer_id
  });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("customer_otp_challenges").insert({
    customer_id: customer.id,
    purpose: input.purpose,
    channel: input.channel,
    target,
    target_normalized: targetNormalized,
    otp_hash: sha256(code),
    requested_ip: input.requestContext?.ipAddress ?? null,
    requested_user_agent: input.requestContext?.userAgent ?? null,
    metadata: {
      email: normalizedEmail,
      phone: formattedPhone,
      full_name: input.fullName ?? customer.full_name ?? null
    },
    expires_at: expiresAt
  });

  if (error) {
    throw new Error(error.message);
  }

  if (input.channel === "email") {
    await sendEmailOtp(normalizedEmail, code, input.fullName ?? customer.full_name);
  } else {
    await sendWhatsAppOtp(formattedPhone, code);
  }

  return {
    message:
      input.channel === "email"
        ? `We sent a verification code to ${maskEmail(normalizedEmail)}.`
        : `We sent a WhatsApp code to ${maskPhone(formattedPhone)}.`
  };
}

function compareOtp(input: string, expectedHash: string) {
  const received = Buffer.from(sha256(input));
  const expected = Buffer.from(expectedHash);

  if (received.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(received, expected);
}

export async function verifyOtp(input: VerifyOtpInput) {
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedPhone = normalizePhone(input.phone);
  const formattedPhone = formatPhone(input.phone);
  const targetNormalized = input.channel === "email" ? normalizedEmail : normalizedPhone;
  const session = await getCurrentSessionRecord();

  await Promise.all([
    enforceRateLimit({
      action: "otp-verify-target",
      bucketKey: `${input.channel}:${targetNormalized}`,
      limit: 8,
      windowMinutes: 15,
      message: "Too many incorrect codes were entered. Please request a new code."
    }),
    input.requestContext?.ipAddress
      ? enforceRateLimit({
          action: "otp-verify-ip",
          bucketKey: input.requestContext.ipAddress,
          limit: 20,
          windowMinutes: 60,
          message: "Too many verification attempts were made from this connection. Please try again later."
        })
      : Promise.resolve()
  ]);

  const { data, error } = await supabaseAdmin
    .from("customer_otp_challenges")
    .select("*")
    .eq("channel", input.channel)
    .eq("target_normalized", targetNormalized)
    .is("consumed_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    throw new Error("Request a fresh verification code and try again.");
  }

  const challenge = data as CustomerOtpChallengeRow;
  if (new Date(challenge.expires_at) <= new Date()) {
    throw new Error("This verification code has expired. Request a new code to continue.");
  }

  if (challenge.attempts >= challenge.max_attempts) {
    throw new Error("Too many incorrect attempts. Request a new code to continue.");
  }

  if (!compareOtp(input.otp.trim(), challenge.otp_hash)) {
    await supabaseAdmin
      .from("customer_otp_challenges")
      .update({
        attempts: challenge.attempts + 1,
        updated_at: new Date().toISOString()
      })
      .eq("id", challenge.id);

    throw new Error("That code did not match. Please check it and try again.");
  }

  const customer = await resolveCustomerByInputs({
    email: normalizedEmail,
    phone: formattedPhone,
    fullName: input.fullName,
    currentCustomerId: session?.customer_id ?? challenge.customer_id
  });
  const names = splitName(input.fullName ?? customer.full_name);

  const { data: updatedCustomer, error: updateError } = await supabaseAdmin
    .from("customers")
    .update({
      email: normalizedEmail,
      phone: formattedPhone,
      first_name: names.firstName ?? customer.first_name,
      last_name: names.lastName ?? customer.last_name,
      full_name: names.fullName ?? customer.full_name,
      email_verified: input.channel === "email" ? true : customer.email_verified,
      phone_verified: input.channel === "whatsapp" ? true : customer.phone_verified,
      updated_at: new Date().toISOString()
    })
    .eq("id", customer.id)
    .select("*")
    .single();

  if (updateError) {
    throw new Error(updateError.message);
  }

  await Promise.all([
    input.channel === "email" || updatedCustomer.email_verified
      ? upsertCustomerAuthIdentity(updatedCustomer.id, "email", normalizedEmail, normalizedEmail)
      : Promise.resolve(),
    input.channel === "whatsapp" || updatedCustomer.phone_verified
      ? upsertCustomerAuthIdentity(updatedCustomer.id, "phone", formattedPhone, normalizedPhone)
      : Promise.resolve(),
    input.channel === "email" || updatedCustomer.email_verified
      ? upsertUserIdentity({
          customerId: updatedCustomer.id,
          provider: "email",
          providerUserId: normalizedEmail,
          email: normalizedEmail,
          providerData: {
            verified: true
          }
        })
      : Promise.resolve(),
    input.channel === "whatsapp" || updatedCustomer.phone_verified
      ? upsertUserIdentity({
          customerId: updatedCustomer.id,
          provider: "phone",
          providerUserId: normalizedPhone,
          email: updatedCustomer.email,
          providerData: {
            phone: formattedPhone,
            verified: true
          }
        })
      : Promise.resolve(),
    supabaseAdmin
      .from("customer_otp_challenges")
      .update({
        verified_at: new Date().toISOString(),
        consumed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", challenge.id)
  ]);

  await claimGuestRecords(updatedCustomer as Customer);

  const wallet = await ensureWallet(updatedCustomer.id);
  const createdSession = await createSession(
    updatedCustomer.id,
    input.channel === "email" ? "email_otp" : "whatsapp_otp"
  );

  return {
    snapshot: await buildSyncSnapshot(updatedCustomer as Customer, wallet, {
      id: "",
      customer_id: updatedCustomer.id,
      auth_method: input.channel === "email" ? "email_otp" : "whatsapp_otp",
      expires_at: createdSession.expiresAt
    }),
    sessionToken: createdSession.token,
    sessionExpiresAt: createdSession.expiresAt
  };
}

async function resolveCustomerFromOAuth(args: {
  user: SupabaseAuthUser;
  provider: OAuthProvider;
  preferredCustomerId?: string | null;
  requireExactCustomer?: boolean;
}) {
  const providerIdentity = getProviderIdentity(args.user, args.provider);
  const providerEmail = getProviderEmail(args.user);

  if (!providerIdentity) {
    throw new Error(`We could not read your ${args.provider} identity from Supabase.`);
  }

  const [preferredCustomerResult, providerIdentityResult, authUserCustomerResult, emailCustomerResult] = await Promise.all([
    args.preferredCustomerId
      ? supabaseAdmin.from("customers").select("*").eq("id", args.preferredCustomerId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabaseAdmin
      .from("user_identities")
      .select("customer_id")
      .eq("provider", args.provider)
      .eq("provider_user_id", providerIdentity.providerUserId)
      .maybeSingle(),
    supabaseAdmin.from("customers").select("*").eq("user_id", args.user.id).maybeSingle(),
    providerEmail
      ? supabaseAdmin.from("customers").select("*").ilike("email", providerEmail).maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const providerIdentityCustomerIds = providerIdentityResult.data?.customer_id ? [providerIdentityResult.data.customer_id as string] : [];
  const { data: providerIdentityCustomers, error: providerIdentityCustomersError } = providerIdentityCustomerIds.length
    ? await supabaseAdmin.from("customers").select("*").in("id", providerIdentityCustomerIds)
    : { data: [], error: null };

  if (providerIdentityCustomersError) {
    throw new Error(providerIdentityCustomersError.message);
  }

  const candidates = sortCustomersForPrimary(
    dedupeCustomers([
      (preferredCustomerResult.data ?? null) as Customer | null,
      ...(providerIdentityCustomers as Customer[]),
      (authUserCustomerResult.data ?? null) as Customer | null,
      (emailCustomerResult.data ?? null) as Customer | null
    ]),
    args.preferredCustomerId
  );

  let customer = candidates[0] ?? null;

  if (args.requireExactCustomer && args.preferredCustomerId && customer && customer.id !== args.preferredCustomerId) {
    return {
      customer,
      providerIdentity,
      providerEmail
    };
  }

  if (candidates.length > 1 && customer) {
    for (const duplicateCustomer of candidates.slice(1)) {
      customer = await mergeCustomers(customer, duplicateCustomer);
    }
  }

  if (!customer) {
    if (!providerEmail) {
      throw new Error(
        `Your ${args.provider} account did not return an email address. Please sign in with OTP first, then connect ${args.provider} from your account page.`
      );
    }

    const names = getProviderFullName(args.user);
    const { data, error } = await supabaseAdmin
      .from("customers")
      .insert({
        user_id: args.user.id,
        first_name: names.firstName,
        last_name: names.lastName,
        full_name: names.fullName,
        email: providerEmail,
        email_verified: true,
        profile_image: getProviderAvatar(args.user)
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    customer = data as Customer;
  }

  return {
    customer,
    providerIdentity,
    providerEmail
  };
}

async function finalizeCustomerFromOAuth(args: {
  customer: Customer;
  user: SupabaseAuthUser;
  provider: OAuthProvider;
  providerUserId: string;
  providerEmail: string | null;
  providerData: Record<string, unknown>;
  avatarUrl: string | null;
}) {
  const names = getProviderFullName(args.user);

  const { data: updatedCustomer, error } = await supabaseAdmin
    .from("customers")
    .update({
      user_id: args.user.id,
      email: args.providerEmail || args.customer.email,
      email_verified: true,
      first_name: args.customer.first_name || names.firstName,
      last_name: args.customer.last_name || names.lastName,
      full_name: args.customer.full_name || names.fullName,
      profile_image: args.customer.profile_image || args.avatarUrl,
      updated_at: new Date().toISOString()
    })
    .eq("id", args.customer.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await Promise.all([
    args.providerEmail
      ? upsertCustomerAuthIdentity(updatedCustomer.id, "email", args.providerEmail, args.providerEmail)
      : Promise.resolve(),
    args.providerEmail
      ? upsertUserIdentity({
          customerId: updatedCustomer.id,
          provider: "email",
          providerUserId: args.providerEmail,
          email: args.providerEmail,
          providerData: {
            source: args.provider
          }
        })
      : Promise.resolve(),
    upsertUserIdentity({
      customerId: updatedCustomer.id,
      provider: args.provider,
      providerUserId: args.providerUserId,
      email: args.providerEmail,
      avatarUrl: args.avatarUrl,
      providerData: args.providerData
    })
  ]);

  await claimGuestRecords(updatedCustomer as Customer);
  return updatedCustomer as Customer;
}

async function buildSyncSnapshot(customer: Customer, wallet: Wallet, session: CustomerSessionRow): Promise<CustomerSyncSnapshot> {
  const linkedProviders = await getLinkedProviders(customer.id);

  return {
    customer: {
      id: customer.id,
      first_name: customer.first_name,
      last_name: customer.last_name,
      full_name: customer.full_name,
      email: customer.email,
      phone: customer.phone,
      email_verified: customer.email_verified,
      phone_verified: customer.phone_verified,
      profile_image: customer.profile_image
    },
    wallet: {
      current_balance: Number(wallet.current_balance)
    },
    session: {
      auth_method: session.auth_method,
      expires_at: session.expires_at
    },
    linked_providers: linkedProviders
  };
}

async function getCustomerFromSession(): Promise<SessionCustomerBundle | null> {
  const session = await getCurrentSessionRecord();
  if (!session) {
    return null;
  }

  const [{ data: customer, error }, wallet] = await Promise.all([
    supabaseAdmin.from("customers").select("*").eq("id", session.customer_id).single(),
    ensureWallet(session.customer_id)
  ]);

  if (error || !customer) {
    return null;
  }

  await claimGuestRecords(customer as Customer);

  return {
    customer: customer as Customer,
    wallet,
    session
  };
}

export async function authenticateWithOAuth(user: SupabaseAuthUser, provider: OAuthProvider) {
  const { customer, providerIdentity, providerEmail } = await resolveCustomerFromOAuth({
    user,
    provider
  });

  const updatedCustomer = await finalizeCustomerFromOAuth({
    customer,
    user,
    provider,
    providerUserId: providerIdentity.providerUserId,
    providerEmail,
    providerData: providerIdentity.providerData,
    avatarUrl: getProviderAvatar(user)
  });

  const wallet = await ensureWallet(updatedCustomer.id);
  const createdSession = await createSession(updatedCustomer.id, authMethodForProvider(provider));

  return {
    snapshot: await buildSyncSnapshot(updatedCustomer, wallet, {
      id: "",
      customer_id: updatedCustomer.id,
      auth_method: authMethodForProvider(provider),
      expires_at: createdSession.expiresAt
    }),
    sessionToken: createdSession.token,
    sessionExpiresAt: createdSession.expiresAt
  };
}

export async function linkOAuthProviderForCurrentCustomer(user: SupabaseAuthUser, provider: OAuthProvider) {
  const session = await getCustomerFromSession();
  if (!session) {
    throw new Error("Sign in before linking a connected account.");
  }

  const { customer: matchedCustomer, providerIdentity, providerEmail } = await resolveCustomerFromOAuth({
    user,
    provider,
    preferredCustomerId: session.customer.id,
    requireExactCustomer: true
  });

  let primaryCustomer = session.customer;
  if (matchedCustomer && matchedCustomer.id !== session.customer.id) {
    const sameEmail =
      providerEmail &&
      normalizeEmail(providerEmail) === normalizeEmail(session.customer.email) &&
      normalizeEmail(providerEmail) === normalizeEmail(matchedCustomer.email);

    if (!sameEmail) {
      throw new Error(
        `This ${provider} account is already linked to a different customer record. Sign in with that account first or contact support to merge it safely.`
      );
    }

    primaryCustomer = await mergeCustomers(session.customer, matchedCustomer);
  }

  if (providerEmail && normalizeEmail(primaryCustomer.email) !== normalizeEmail(providerEmail)) {
    throw new Error(
      `This ${provider} account uses ${providerEmail}, which does not match the email on your current Creatorstack account.`
    );
  }

  const updatedCustomer = await finalizeCustomerFromOAuth({
    customer: primaryCustomer,
    user,
    provider,
    providerUserId: providerIdentity.providerUserId,
    providerEmail,
    providerData: providerIdentity.providerData,
    avatarUrl: getProviderAvatar(user)
  });

  const wallet = await ensureWallet(updatedCustomer.id);
  return buildSyncSnapshot(updatedCustomer, wallet, session.session);
}

export async function syncCurrentCustomer() {
  const session = await getCustomerFromSession();
  if (!session) {
    return null;
  }

  return buildSyncSnapshot(session.customer, session.wallet, session.session);
}

export async function requireVerifiedCustomer() {
  const session = await getCustomerFromSession();
  if (!session) {
    throw new Error("Sign in or verify your details to continue.");
  }

  if (!session.customer.email_verified || !session.customer.phone_verified) {
    throw new Error("Verify both your email and WhatsApp number before continuing.");
  }

  return session;
}

export async function requireAuthenticatedCustomer() {
  const session = await getCustomerFromSession();
  if (!session) {
    throw new Error("Sign in to continue.");
  }

  return session;
}

export async function getCustomerPortalSnapshot() {
  const session = await getCustomerFromSession();
  if (!session) {
    return null;
  }

  const [{ data: orders }, { data: accessGrants }, { data: walletTransactions }, linkedProviders] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("*")
      .eq("customer_id", session.customer.id)
      .order("purchase_date", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("access_grants")
      .select("*")
      .eq("customer_id", session.customer.id)
      .eq("access_revoked", false)
      .order("created_at", { ascending: false })
      .limit(8),
    supabaseAdmin
      .from("wallet_transactions")
      .select("*")
      .eq("wallet_id", session.wallet.id)
      .order("created_at", { ascending: false })
      .limit(10),
    getLinkedProviders(session.customer.id)
  ]);

  return {
    customer: session.customer,
    wallet: session.wallet,
    orders: (orders ?? []) as Order[],
    accessGrants: accessGrants ?? [],
    walletTransactions: walletTransactions ?? [],
    linkedProviders
  };
}

export function applySessionCookie(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } },
  token: string,
  expiresAt: string
) {
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.siteUrl.startsWith("https://"),
    path: "/",
    expires: new Date(expiresAt)
  });
}

export function clearSessionCookie(
  response: { cookies: { set: (name: string, value: string, options: Record<string, unknown>) => void } }
) {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: env.siteUrl.startsWith("https://"),
    path: "/",
    expires: new Date(0)
  });
}

export async function signOutCurrentCustomer() {
  const session = await getCurrentSessionRecord();
  if (session) {
    await supabaseAdmin.from("customer_sessions").delete().eq("id", session.id);
  }
}
