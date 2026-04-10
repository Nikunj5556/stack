import { supabaseAdmin } from "@/lib/supabase/admin";
import type {
  Conversation,
  ConversationMessage,
  Customer,
  ProductReview,
  SupportTicket,
  SupportWorkspaceData,
  TicketMessage
} from "@/lib/supabase/types";
import {
  conversationSchema,
  reviewSchema,
  supportTicketSchema,
  ticketReplySchema
} from "@/lib/commerce/schemas";

function inferMediaType(url: string) {
  const lower = url.toLowerCase();
  if (/\.(mp4|mov|webm|m4v|avi)(\?|$)/.test(lower)) {
    return "video" as const;
  }

  if (/\.(jpg|jpeg|png|gif|webp|avif|svg)(\?|$)/.test(lower)) {
    return "image" as const;
  }

  return null;
}

export async function getSupportWorkspace(customerId: string): Promise<SupportWorkspaceData> {
  const [{ data: customer }, { data: conversations }, { data: tickets }] = await Promise.all([
    supabaseAdmin.from("customers").select("*").eq("id", customerId).single(),
    supabaseAdmin.from("conversations").select("*").eq("customer_id", customerId).order("created_at", { ascending: false }),
    supabaseAdmin.from("support_tickets").select("*").eq("customer_id", customerId).order("updated_at", { ascending: false })
  ]);

  const firstConversation = (conversations ?? [])[0];
  const firstTicket = (tickets ?? [])[0];

  const [{ data: conversationMessages }, { data: ticketMessages }] = await Promise.all([
    firstConversation
      ? supabaseAdmin
          .from("conversation_messages")
          .select("*")
          .eq("conversation_id", firstConversation.id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
    firstTicket
      ? supabaseAdmin
          .from("ticket_messages")
          .select("*")
          .eq("ticket_id", firstTicket.id)
          .order("sent_at")
      : Promise.resolve({ data: [] })
  ]);

  return {
    customer: customer as Customer,
    conversations: (conversations ?? []) as Conversation[],
    conversationMessages: (conversationMessages ?? []) as ConversationMessage[],
    tickets: (tickets ?? []) as SupportTicket[],
    ticketMessages: (ticketMessages ?? []) as TicketMessage[]
  };
}

export async function createConversation(customer: Customer) {
  const { data: existing } = await supabaseAdmin
    .from("conversations")
    .select("*")
    .eq("customer_id", customer.id)
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    return existing as Conversation;
  }

  const { data, error } = await supabaseAdmin
    .from("conversations")
    .insert({
      customer_id: customer.id,
      channel: "website",
      status: "open",
      last_message_at: new Date().toISOString()
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as Conversation;
}

export async function sendConversationMessage(customer: Customer, conversationId: string, payload: unknown) {
  const parsed = conversationSchema.parse(payload);
  const { data, error } = await supabaseAdmin
    .from("conversation_messages")
    .insert({
      conversation_id: conversationId,
      sender_type: "customer",
      sender_id: customer.id,
      content: parsed.content,
      attachments: parsed.attachments,
      delivery_status: "sent",
      is_read: false
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabaseAdmin
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conversationId);

  return data as ConversationMessage;
}

export async function createSupportTicket(customer: Customer, payload: unknown) {
  const parsed = supportTicketSchema.parse(payload);
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({
      customer_id: customer.id,
      guest_email: customer.email,
      guest_phone: customer.phone,
      subject: parsed.subject,
      description: parsed.description,
      category: parsed.category ?? null,
      priority: parsed.priority,
      status: "open",
      related_order_id: parsed.relatedOrderId ?? null,
      related_product_id: parsed.relatedProductId ?? null,
      channel: "live_chat"
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabaseAdmin.from("ticket_messages").insert({
    ticket_id: data.id,
    sender_type: "customer",
    sender_id: customer.id,
    message_body: parsed.description,
    attachments: parsed.attachments,
    is_read: false
  });

  return data as SupportTicket;
}

export async function sendTicketMessage(customer: Customer, ticketId: string, payload: unknown) {
  const parsed = ticketReplySchema.parse(payload);
  const { data, error } = await supabaseAdmin
    .from("ticket_messages")
    .insert({
      ticket_id: ticketId,
      sender_type: "customer",
      sender_id: customer.id,
      message_body: parsed.message,
      attachments: parsed.attachments,
      is_read: false
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  if (parsed.attachments.length > 0) {
    await supabaseAdmin.from("support_attachments").insert(
      parsed.attachments.map((attachment) => ({
        ticket_id: ticketId,
        message_id: data.id,
        file_name: attachment.split("/").pop() ?? "attachment",
        file_url: attachment,
        uploaded_by: customer.id
      }))
    );
  }

  await supabaseAdmin
    .from("support_tickets")
    .update({
      updated_at: new Date().toISOString(),
      status: "pending"
    })
    .eq("id", ticketId);

  return data as TicketMessage;
}

export async function createProductReview(customer: Customer, payload: unknown) {
  const parsed = reviewSchema.parse(payload);
  const { data: grants } = await supabaseAdmin
    .from("access_grants")
    .select("product_id, order_id")
    .eq("customer_id", customer.id)
    .eq("product_id", parsed.productId)
    .limit(1);

  const purchase = grants?.[0];

  const { data, error } = await supabaseAdmin
    .from("product_reviews")
    .upsert(
      {
        product_id: parsed.productId,
        customer_id: customer.id,
        order_id: purchase?.order_id ?? null,
        rating: parsed.rating,
        title: parsed.reviewTitle ?? null,
        review_text: parsed.reviewBody ?? null,
        is_verified_purchase: Boolean(purchase),
        status: "published",
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "product_id,customer_id"
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await supabaseAdmin.from("product_review_media").delete().eq("review_id", data.id);

  if (parsed.attachments.length) {
    const { error: mediaError } = await supabaseAdmin.from("product_review_media").insert(
      parsed.attachments.map((attachment, index) => ({
        review_id: data.id,
        media_url: attachment,
        media_type: inferMediaType(attachment),
        sort_order: index
      }))
    );

    if (mediaError) {
      throw new Error(mediaError.message);
    }
  }

  const { data: reviewWithMedia, error: reviewError } = await supabaseAdmin
    .from("product_reviews")
    .select("*, customers(id, first_name, last_name, full_name, profile_image), product_review_media(*)")
    .eq("id", data.id)
    .single();

  if (reviewError) {
    throw new Error(reviewError.message);
  }

  return {
    ...(reviewWithMedia as ProductReview),
    customer: (reviewWithMedia as any).customers ?? null,
    media: ((reviewWithMedia as any).product_review_media ?? []).sort(
      (left: { sort_order: number }, right: { sort_order: number }) => left.sort_order - right.sort_order
    )
  } as ProductReview;
}
