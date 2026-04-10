import type { Coupon, Customer, GiftCard, ProductWithRelations, Wallet } from "@/lib/supabase/types";

export interface CheckoutLine {
  product: ProductWithRelations;
  variantId?: string | null;
  quantity: number;
}

export interface CheckoutCalculation {
  subtotal: number;
  discount: number;
  couponDiscount: number;
  giftCardApplied: number;
  walletApplied: number;
  total: number;
  amountDue: number;
}

export function getUnitPrice(product: ProductWithRelations, variantId?: string | null) {
  const variant = product.product_variants?.find((item) => item.id === variantId);
  return Number(variant?.price ?? product.base_price ?? 0);
}

export function calculateSubtotal(lines: CheckoutLine[]) {
  return lines.reduce((sum, line) => sum + getUnitPrice(line.product, line.variantId) * line.quantity, 0);
}

function matchesCoupon(line: CheckoutLine, coupon: Coupon) {
  const product = line.product;
  const productAllowed =
    coupon.applicable_products.length === 0 || coupon.applicable_products.includes(product.id);
  const categoryAllowed =
    coupon.applicable_categories.length === 0 ||
    (product.category_id ? coupon.applicable_categories.includes(product.category_id) : false);
  const notExcluded = !coupon.excluded_products.includes(product.id);

  return productAllowed && categoryAllowed && notExcluded;
}

export function computeCouponDiscount({
  coupon,
  customer,
  lines,
  subtotal
}: {
  coupon: Coupon | null;
  customer: Customer;
  lines: CheckoutLine[];
  subtotal: number;
}) {
  if (!coupon || !coupon.is_active) {
    return 0;
  }

  if (subtotal < Number(coupon.min_cart_value)) {
    return 0;
  }

  if (coupon.excluded_customers.includes(customer.id)) {
    return 0;
  }

  if ((coupon.new_user_only || coupon.first_order_only) && customer.total_orders > 0) {
    return 0;
  }

  const eligibleSubtotal = lines
    .filter((line) => matchesCoupon(line, coupon))
    .reduce((sum, line) => sum + getUnitPrice(line.product, line.variantId) * line.quantity, 0);

  if (eligibleSubtotal <= 0) {
    return 0;
  }

  if (coupon.coupon_type === "percentage") {
    const computed = eligibleSubtotal * (Number(coupon.discount_value) / 100);
    return Math.min(computed, Number(coupon.max_discount_amount ?? computed));
  }

  if (coupon.coupon_type === "fixed") {
    return Math.min(Number(coupon.discount_value), eligibleSubtotal);
  }

  return 0;
}

export function computeGiftCardUsage(totalAfterCoupon: number, giftCard: GiftCard | null) {
  if (!giftCard || giftCard.status !== "active") {
    return 0;
  }

  if (giftCard.expiry_date && new Date(giftCard.expiry_date) < new Date()) {
    return 0;
  }

  return Math.min(totalAfterCoupon, Number(giftCard.balance));
}

export function computeWalletUsage(totalAfterCredits: number, wallet: Wallet | null, useWallet: boolean) {
  if (!wallet || !useWallet) {
    return 0;
  }

  return Math.min(totalAfterCredits, Number(wallet.current_balance));
}

export function calculateCheckout({
  lines,
  coupon,
  giftCard,
  wallet,
  useWallet,
  customer
}: {
  lines: CheckoutLine[];
  coupon: Coupon | null;
  giftCard: GiftCard | null;
  wallet: Wallet | null;
  useWallet: boolean;
  customer: Customer;
}): CheckoutCalculation {
  const subtotal = calculateSubtotal(lines);
  const couponDiscount = computeCouponDiscount({ coupon, customer, lines, subtotal });
  const totalAfterCoupon = Math.max(0, subtotal - couponDiscount);
  const giftCardApplied = computeGiftCardUsage(totalAfterCoupon, giftCard);
  const totalAfterGift = Math.max(0, totalAfterCoupon - giftCardApplied);
  const walletApplied = computeWalletUsage(totalAfterGift, wallet, useWallet);
  const amountDue = Math.max(0, totalAfterGift - walletApplied);

  return {
    subtotal,
    discount: couponDiscount,
    couponDiscount,
    giftCardApplied,
    walletApplied,
    total: subtotal - couponDiscount,
    amountDue
  };
}
