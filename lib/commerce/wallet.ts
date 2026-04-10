import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Customer, Payment, Wallet } from "@/lib/supabase/types";
import { razorpay, verifyRazorpaySignature } from "@/lib/integrations/razorpay";
import { toMinorUnits } from "@/lib/utils";

export async function createWalletTopupOrder(args: { customer: Customer; amount: number }) {
  const razorpayOrder = await razorpay.orders.create({
    amount: toMinorUnits(args.amount),
    currency: "INR",
    receipt: `wallet-topup-${args.customer.id}-${Date.now()}`,
    notes: {
      customer_id: args.customer.id,
      kind: "wallet_topup"
    }
  });

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .insert({
      customer_id: args.customer.id,
      payment_provider: "razorpay",
      provider_order_id: razorpayOrder.id,
      payment_method: "wallet_topup",
      payment_status: "pending",
      paid_amount: args.amount,
      currency: "INR",
      verification_status: "pending",
      gateway_response: {
        kind: "wallet_topup"
      }
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    paymentId: payment.id,
    razorpayOrder: {
      id: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency
    }
  };
}

export async function verifyWalletTopup(args: {
  customer: Customer;
  wallet: Wallet;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const isValid = verifyRazorpaySignature({
    orderId: args.razorpayOrderId,
    paymentId: args.razorpayPaymentId,
    signature: args.razorpaySignature
  });

  if (!isValid) {
    throw new Error("Razorpay signature verification failed.");
  }

  const { data: payment, error } = await supabaseAdmin
    .from("payments")
    .select("*")
    .eq("provider_order_id", args.razorpayOrderId)
    .eq("customer_id", args.customer.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if ((payment as Payment).payment_status === "captured") {
    return {
      walletBalance: args.wallet.current_balance
    };
  }

  const fetchedPayment = await razorpay.payments.fetch(args.razorpayPaymentId);
  if (fetchedPayment.status === "authorized") {
    await razorpay.payments.capture(args.razorpayPaymentId, fetchedPayment.amount, fetchedPayment.currency);
  }

  const amount = Number((payment as Payment).paid_amount);

  await Promise.all([
    supabaseAdmin
      .from("payments")
      .update({
        payment_status: "captured",
        provider_payment_id: args.razorpayPaymentId,
        payment_timestamp: new Date().toISOString(),
        verification_status: "verified",
        gateway_response: fetchedPayment
      })
      .eq("id", payment.id),
    supabaseAdmin
      .from("wallets")
      .update({
        current_balance: Number(args.wallet.current_balance) + amount,
        lifetime_credited: Number(args.wallet.lifetime_credited) + amount,
        last_updated: new Date().toISOString()
      })
      .eq("id", args.wallet.id),
    supabaseAdmin.from("wallet_transactions").insert({
      wallet_id: args.wallet.id,
      type: "credit",
      amount,
      reason: "Wallet top-up",
      related_payment_id: payment.id,
      performed_by: "customer",
      performed_by_id: args.customer.id
    })
  ]);

  return {
    walletBalance: Number(args.wallet.current_balance) + amount
  };
}
