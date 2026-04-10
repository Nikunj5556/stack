import { z } from "zod";

export const addressSchema = z.object({
  full_name: z.string().min(2),
  address_line1: z.string().min(3),
  address_line2: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  city: z.string().min(2),
  district: z.string().optional().nullable(),
  state: z.string().min(2),
  postal_code: z.string().min(4),
  country: z.string().default("India"),
  phone_number: z.string().optional().nullable(),
  email: z.string().email().optional().nullable()
});

export const cartLineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional().nullable(),
  quantity: z.number().int().min(1).max(10).default(1)
});

export const checkoutSchema = z.object({
  items: z.array(cartLineSchema).min(1),
  couponCode: z.string().trim().max(64).optional().nullable(),
  giftCardCode: z.string().trim().max(64).optional().nullable(),
  useWallet: z.boolean().default(false),
  notes: z.string().trim().max(2000).optional().nullable(),
  billingAddress: addressSchema.optional().nullable(),
  tracking: z
    .object({
      purchaseEventId: z.string().trim().max(255),
      eventSourceUrl: z.string().url()
    })
    .optional()
    .nullable()
});

export const reviewSchema = z.object({
  productId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  reviewTitle: z.string().trim().max(120).optional().nullable(),
  reviewBody: z.string().trim().max(2000).optional().nullable(),
  attachments: z.array(z.string().url()).max(5).default([])
});

export const conversationSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  attachments: z.array(z.string().url()).max(5).default([])
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(5).max(180),
  description: z.string().trim().min(10).max(3000),
  category: z.string().trim().max(40).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  relatedOrderId: z.string().uuid().optional().nullable(),
  relatedProductId: z.string().uuid().optional().nullable(),
  attachments: z.array(z.string().url()).max(5).default([])
});

export const ticketReplySchema = z.object({
  message: z.string().trim().min(1).max(4000),
  attachments: z.array(z.string().url()).max(5).default([])
});

export const walletTopupSchema = z.object({
  amount: z.number().min(1).max(10000)
});
