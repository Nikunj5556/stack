import { randomUUID } from "node:crypto";

import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  CheckoutSession,
  Coupon,
  Customer,
  GiftCard,
  Order,
  OrderItem,
  Payment,
  ProductWithRelations,
  Wallet
} from "@/lib/supabase/types";
import { razorpay, verifyRazorpaySignature } from "@/lib/integrations/razorpay";
import { env } from "@/lib/env";
import { toMinorUnits } from "@/lib/utils";
import { calculateCheckout, getUnitPrice, type CheckoutLine, type CheckoutCalculation } from "@/lib/commerce/pricing";
import { checkoutSchema } from "@/lib/commerce/schemas";
import { sendMetaConversionEvent } from "@/lib/meta/server";

interface RequestMetaContext {
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}

function getFirstName(customer: Customer) {
  return customer.first_name || customer.full_name?.trim().split(/\s+/)[0] || null;
}

function getCountryFromOrder(order: Order) {
  const billingAddress = order.billing_address_snapshot;

  if (!billingAddress || typeof billingAddress !== "object" || Array.isArray(billingAddress)) {
    return "India";
  }

  const country = (billingAddress as Record<string, unknown>).country;
  return typeof country === "string" && country.trim() ? country : "India";
}

async function sendPurchaseMetaEvent(args: {
  customer: Customer;
  order: Order;
  eventId: string;
  eventSourceUrl?: string | null;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}) {
  await sendMetaConversionEvent({
    eventName: "Purchase",
    eventId: args.eventId,
    eventSourceUrl: args.eventSourceUrl || `${env.siteUrl}/checkout`,
    customData: {
      currency: orderCurrency(args.order),
      value: Number(args.order.grand_total)
    },
    customer: {
      country: getCountryFromOrder(args.order),
      email: args.customer.email,
      firstName: getFirstName(args.customer),
      phone: args.customer.phone
    },
    clientIpAddress: args.clientIpAddress,
    clientUserAgent: args.clientUserAgent
  });
}

function orderCurrency(order: Order) {
  return order.currency || "INR";
}

async function loadProducts(lines: { productId: string; variantId?: string | null; quantity: number }[]) {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("*, product_variants(*), digital_files(*)")
    .in("id", productIds)
    .eq("status", "active");

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []) as ProductWithRelations[];
}

async function findCoupon(code?: string | null) {
  if (!code) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("coupons")
    .select("*")
    .ilike("code", code)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as Coupon | null;
}

async function findGiftCard(code?: string | null) {
  if (!code) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("gift_cards")
    .select("*")
    .ilike("gift_code", code)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as GiftCard | null;
}

async function createCheckoutRecords(args: {
  customer: Customer;
  lines: CheckoutLine[];
  summary: CheckoutCalculation;
  notes?: string | null;
  billingAddress?: Record<string, unknown> | null;
  coupon: Coupon | null;
  giftCard: GiftCard | null;
}) {
  const { customer, lines, summary, notes, billingAddress, coupon, giftCard } = args;

  const { data: cart, error: cartError } = await supabaseAdmin
    .from("carts")
    .insert({
      customer_id: customer.id,
      currency: "INR",
      subtotal: summary.subtotal,
      total: summary.total,
      checkout_started: true,
      checkout_started_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (cartError) {
    throw new Error(cartError.message);
  }

  const { error: cartItemsError } = await supabaseAdmin.from("cart_items").insert(
    lines.map((line) => ({
      cart_id: cart.id,
      product_id: line.product.id,
      variant_id: line.variantId ?? null,
      quantity: line.quantity,
      unit_price: getUnitPrice(line.product, line.variantId),
      compare_price: line.product.compare_at_price,
      discounted_price: getUnitPrice(line.product, line.variantId),
      line_total: getUnitPrice(line.product, line.variantId) * line.quantity
    }))
  );

  if (cartItemsError) {
    throw new Error(cartItemsError.message);
  }

  const { data: checkout, error: checkoutError } = await supabaseAdmin
    .from("checkout_sessions")
    .insert({
      cart_id: cart.id,
      customer_id: customer.id,
      guest_email: customer.email,
      guest_phone: customer.phone,
      billing_address_snapshot: billingAddress ?? {},
      shipping_address_snapshot: billingAddress ?? {},
      coupon_snapshot: coupon ?? {},
      order_summary_snapshot: {
        ...summary,
        coupon_code: coupon?.code ?? null,
        gift_card_code: giftCard?.gift_code ?? null
      },
      payment_method_selected: summary.amountDue > 0 ? "razorpay" : "wallet",
      status: summary.amountDue > 0 ? "payment_pending" : "paid"
    })
    .select("*")
    .single();

  if (checkoutError) {
    throw new Error(checkoutError.message);
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .insert({
      customer_id: customer.id,
      guest_customer_data: {
        checkout_mode: "verified_guest"
      },
      order_status: summary.amountDue > 0 ? "pending" : "paid",
      payment_status: summary.amountDue > 0 ? "pending" : "captured",
      fulfillment_status: "unfulfilled",
      delivery_status: "pending",
      source_channel: "website",
      currency: "INR",
      subtotal: summary.subtotal,
      discount_total: summary.couponDiscount + summary.giftCardApplied + summary.walletApplied,
      grand_total: summary.total,
      name_snapshot: customer.full_name,
      email_snapshot: customer.email,
      phone_snapshot: customer.phone,
      billing_address_snapshot: billingAddress ?? {},
      shipping_address_snapshot: billingAddress ?? {},
      order_notes: notes ?? null,
      custom_fields: {
        checkout_session_id: checkout.id,
        wallet_applied: summary.walletApplied,
        gift_card_applied: summary.giftCardApplied,
        gift_card_code: giftCard?.gift_code ?? null,
        coupon_code: coupon?.code ?? null
      }
    })
    .select("*")
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  const { data: orderItems, error: orderItemsError } = await supabaseAdmin
    .from("order_items")
    .insert(
      lines.map((line) => ({
        order_id: order.id,
        product_id_snapshot: line.product.id,
        product_name_snapshot: line.product.name,
        variant_id_snapshot: line.variantId ?? null,
        variant_name_snapshot:
          line.product.product_variants?.find((variant) => variant.id === line.variantId)?.variant_name ?? null,
        sku_snapshot: line.product.sku,
        quantity: line.quantity,
        unit_price: getUnitPrice(line.product, line.variantId),
        compare_price: line.product.compare_at_price,
        discount_amount: 0,
        tax_amount: 0,
        line_total: getUnitPrice(line.product, line.variantId) * line.quantity,
        product_type_snapshot: line.product.product_type,
        delivery_method_snapshot: ["direct_download"],
        download_entitlement_snap: {
          file_count: line.product.digital_files?.length ?? 0
        },
        fulfillment_status: "unfulfilled"
      }))
    )
    .select("*");

  if (orderItemsError) {
    throw new Error(orderItemsError.message);
  }

  return {
    checkout: checkout as CheckoutSession,
    order: order as Order,
    orderItems: (orderItems ?? []) as OrderItem[]
  };
}

async function applyCreditsAndMetrics(args: {
  customer: Customer;
  wallet: Wallet | null;
  payment: Payment;
  order: Order;
  summary: CheckoutCalculation;
  giftCard: GiftCard | null;
  coupon: Coupon | null;
}) {
  const { customer, wallet, payment, order, summary, giftCard, coupon } = args;

  if (summary.walletApplied > 0 && wallet) {
    await supabaseAdmin
      .from("wallets")
      .update({
        current_balance: Number(wallet.current_balance) - summary.walletApplied,
        lifetime_debited: Number(wallet.lifetime_debited) + summary.walletApplied,
        last_updated: new Date().toISOString()
      })
      .eq("id", wallet.id);

    await supabaseAdmin.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      type: "purchase",
      amount: summary.walletApplied,
      reason: "Order checkout",
      related_order_id: order.id,
      related_payment_id: payment.id,
      performed_by: "customer",
      performed_by_id: customer.id
    });
  }

  if (giftCard && summary.giftCardApplied > 0) {
    const remainingBalance = Number(giftCard.balance) - summary.giftCardApplied;
    await supabaseAdmin
      .from("gift_cards")
      .update({
        balance: remainingBalance,
        redeemed_by: customer.id,
        redeemed_at: new Date().toISOString(),
        status: remainingBalance <= 0 ? "redeemed" : "active"
      })
      .eq("id", giftCard.id);
  }

  if (coupon) {
    await supabaseAdmin
      .from("coupons")
      .update({
        current_usage_count: coupon.current_usage_count + 1
      })
      .eq("id", coupon.id);
  }

  await supabaseAdmin
    .from("customers")
    .update({
      total_orders: customer.total_orders + 1,
      total_spend: Number(customer.total_spend) + Number(order.grand_total)
    })
    .eq("id", customer.id);
}

async function grantDownloads(order: Order, orderItems: OrderItem[], customer: Customer) {
  const productIds = [...new Set(orderItems.map((item) => item.product_id_snapshot).filter(Boolean) as string[])];
  const { data: files, error } = await supabaseAdmin.from("digital_files").select("*").in("product_id", productIds);

  if (error) {
    throw new Error(error.message);
  }

  const payload = orderItems.flatMap((orderItem) =>
    (files ?? [])
      .filter((file) => file.product_id === orderItem.product_id_snapshot)
      .map((file) => ({
        order_id: order.id,
        order_item_id: orderItem.id,
        customer_id: customer.id,
        product_id: orderItem.product_id_snapshot,
        digital_file_id: file.id,
        delivery_method: ["direct_download"],
        delivered_at: new Date().toISOString(),
        delivery_success: true,
        download_count: 0,
        download_limit: file.download_limit,
        download_expiry_at: file.download_expiry_seconds
          ? new Date(Date.now() + file.download_expiry_seconds * 1000).toISOString()
          : null,
        expires_at: file.download_expiry_seconds
          ? new Date(Date.now() + file.download_expiry_seconds * 1000).toISOString()
          : null
      }))
  );

  if (payload.length) {
    await supabaseAdmin.from("access_grants").insert(payload);
  }
}

async function finalizeOrder(args: {
  customer: Customer;
  wallet: Wallet | null;
  payment: Payment;
  order: Order;
  checkout: CheckoutSession;
  summary: CheckoutCalculation;
  giftCard: GiftCard | null;
  coupon: Coupon | null;
  providerPaymentId?: string | null;
  gatewayResponse?: Record<string, unknown>;
}) {
  const { customer, wallet, payment, order, checkout, summary, giftCard, coupon, providerPaymentId, gatewayResponse } =
    args;

  if (payment.payment_status === "captured" && order.order_status === "completed") {
    return order;
  }

  await supabaseAdmin
    .from("payments")
    .update({
      payment_status: "captured",
      verification_status: "verified",
      provider_payment_id: providerPaymentId ?? payment.provider_payment_id,
      payment_timestamp: new Date().toISOString(),
      gateway_response: gatewayResponse ?? payment.gateway_response
    })
    .eq("id", payment.id);

  const { data: updatedOrder, error: orderError } = await supabaseAdmin
    .from("orders")
    .update({
      order_status: "completed",
      payment_status: "captured",
      fulfillment_status: "fulfilled",
      delivery_status: "delivered",
      completion_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", order.id)
    .select("*")
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  await supabaseAdmin.from("order_items").update({ fulfillment_status: "fulfilled" }).eq("order_id", order.id);
  const { data: orderItems } = await supabaseAdmin.from("order_items").select("*").eq("order_id", order.id);

  await Promise.all([
    applyCreditsAndMetrics({ customer, wallet, payment, order: updatedOrder as Order, summary, giftCard, coupon }),
    grantDownloads(updatedOrder as Order, (orderItems ?? []) as OrderItem[], customer),
    supabaseAdmin
      .from("checkout_sessions")
      .update({
        status: "completed",
        updated_at: new Date().toISOString()
      })
      .eq("id", checkout.id),
    supabaseAdmin.from("order_events").insert({
      order_id: order.id,
      event_type: "digital_delivery_ready",
      actor: "system",
      notes: "Access grants were created."
    })
  ]);

  return updatedOrder as Order;
}

export async function initiateCheckout(args: {
  customer: Customer;
  wallet: Wallet | null;
  input: unknown;
  requestMeta?: RequestMetaContext;
}) {
  const parsed = checkoutSchema.parse(args.input);
  const purchaseEventId = parsed.tracking?.purchaseEventId || `purchase-${randomUUID()}`;
  const [products, coupon, giftCard] = await Promise.all([
    loadProducts(parsed.items),
    findCoupon(parsed.couponCode),
    findGiftCard(parsed.giftCardCode)
  ]);

  const lines: CheckoutLine[] = parsed.items.map((item) => {
    const product = products.find((entry) => entry.id === item.productId);
    if (!product) {
      throw new Error("One of the cart items is unavailable.");
    }
    return { product, variantId: item.variantId ?? null, quantity: item.quantity };
  });

  const summary = calculateCheckout({
    lines,
    coupon,
    giftCard,
    wallet: args.wallet,
    useWallet: parsed.useWallet,
    customer: args.customer
  });

  const { checkout, order, orderItems } = await createCheckoutRecords({
    customer: args.customer,
    lines,
    summary,
    notes: parsed.notes,
    billingAddress: parsed.billingAddress ?? null,
    coupon,
    giftCard
  });

  if (summary.amountDue <= 0) {
    const { data: payment, error } = await supabaseAdmin
      .from("payments")
      .insert({
        order_id: order.id,
        customer_id: args.customer.id,
        payment_provider: "wallet",
        payment_method: "wallet_or_gift",
        payment_status: "captured",
        paid_amount: 0,
        currency: "INR",
        payment_timestamp: new Date().toISOString(),
        verification_status: "verified",
        gateway_response: {
          wallet_applied: summary.walletApplied,
          gift_card_applied: summary.giftCardApplied
        }
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    const completedOrder = await finalizeOrder({
      customer: args.customer,
      wallet: args.wallet,
      payment: payment as Payment,
      order,
      checkout,
      summary,
      giftCard,
      coupon
    });

    await sendPurchaseMetaEvent({
      customer: args.customer,
      order: completedOrder,
      eventId: purchaseEventId,
      eventSourceUrl: parsed.tracking?.eventSourceUrl,
      clientIpAddress: args.requestMeta?.clientIpAddress,
      clientUserAgent: args.requestMeta?.clientUserAgent
    });

    return {
      mode: "wallet_only" as const,
      checkoutSessionId: checkout.id,
      orderId: completedOrder.id,
      orderNumber: completedOrder.order_number,
      purchase: {
        eventId: purchaseEventId,
        value: Number(completedOrder.grand_total),
        currency: orderCurrency(completedOrder)
      }
    };
  }

  const razorpayOrder = await razorpay.orders.create({
    amount: toMinorUnits(summary.amountDue),
    currency: "INR",
    receipt: `creatorstack-${checkout.id}`,
    notes: {
      checkout_session_id: checkout.id,
      order_id: order.id,
      customer_id: args.customer.id
    }
  });

  const { data: payment, error: paymentError } = await supabaseAdmin
    .from("payments")
    .insert({
      order_id: order.id,
      customer_id: args.customer.id,
      payment_provider: "razorpay",
      provider_order_id: razorpayOrder.id,
      payment_method: "razorpay",
      payment_status: "pending",
      paid_amount: summary.amountDue,
      currency: "INR",
      verification_status: "pending",
      gateway_response: {
        wallet_applied: summary.walletApplied,
        gift_card_applied: summary.giftCardApplied
      }
    })
    .select("*")
    .single();

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  return {
    mode: "razorpay" as const,
    checkoutSessionId: checkout.id,
    orderId: order.id,
    paymentId: payment.id,
    amountDue: summary.amountDue,
    razorpayOrder: {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    },
    summary,
    orderItems,
    purchase: {
      eventId: purchaseEventId,
      value: summary.total,
      currency: "INR"
    }
  };
}

export async function verifyCheckoutPayment(args: {
  customer: Customer;
  wallet: Wallet | null;
  checkoutSessionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
  purchaseEventId?: string;
  eventSourceUrl?: string;
  clientIpAddress?: string | null;
  clientUserAgent?: string | null;
}) {
  const isValid = verifyRazorpaySignature({
    orderId: args.razorpayOrderId,
    paymentId: args.razorpayPaymentId,
    signature: args.razorpaySignature
  });

  if (!isValid) {
    throw new Error("Razorpay signature verification failed.");
  }

  const [{ data: checkout }, { data: payment }] = await Promise.all([
    supabaseAdmin
      .from("checkout_sessions")
      .select("*")
      .eq("id", args.checkoutSessionId)
      .eq("customer_id", args.customer.id)
      .single(),
    supabaseAdmin
      .from("payments")
      .select("*")
      .eq("provider_order_id", args.razorpayOrderId)
      .eq("customer_id", args.customer.id)
      .single()
  ]);

  const fetchedPayment = await razorpay.payments.fetch(args.razorpayPaymentId);
  if (fetchedPayment.status === "authorized") {
    await razorpay.payments.capture(args.razorpayPaymentId, fetchedPayment.amount, fetchedPayment.currency);
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("id", (payment as Payment).order_id ?? "")
    .single();

  if (orderError) {
    throw new Error(orderError.message);
  }

  const orderSummary = (checkout as CheckoutSession).order_summary_snapshot as Record<string, unknown>;
  const [giftCard, coupon] = await Promise.all([
    findGiftCard(typeof orderSummary.gift_card_code === "string" ? orderSummary.gift_card_code : undefined),
    findCoupon(typeof orderSummary.coupon_code === "string" ? orderSummary.coupon_code : undefined)
  ]);

  const finalizedOrder = await finalizeOrder({
    customer: args.customer,
    wallet: args.wallet,
    payment: payment as Payment,
    order: order as Order,
    checkout: checkout as CheckoutSession,
    summary: {
      subtotal: Number((order as Order).subtotal),
      discount: Number((order as Order).discount_total),
      couponDiscount: Number((order as Order).discount_total) -
        Number(orderSummary.gift_card_applied ?? 0) -
        Number(orderSummary.wallet_applied ?? 0),
      giftCardApplied: Number(orderSummary.gift_card_applied ?? 0),
      walletApplied: Number(orderSummary.wallet_applied ?? 0),
      total: Number((order as Order).grand_total),
      amountDue: Number((payment as Payment).paid_amount)
    },
    giftCard,
    coupon,
    providerPaymentId: args.razorpayPaymentId,
    gatewayResponse: fetchedPayment as unknown as Record<string, unknown>
  });

  await sendPurchaseMetaEvent({
    customer: args.customer,
    order: finalizedOrder,
    eventId: args.purchaseEventId || `purchase-${finalizedOrder.id}`,
    eventSourceUrl: args.eventSourceUrl,
    clientIpAddress: args.clientIpAddress,
    clientUserAgent: args.clientUserAgent
  });

  return {
    orderId: finalizedOrder.id,
    orderNumber: finalizedOrder.order_number,
    purchase: {
      eventId: args.purchaseEventId || `purchase-${finalizedOrder.id}`,
      value: Number(finalizedOrder.grand_total),
      currency: orderCurrency(finalizedOrder)
    }
  };
}
