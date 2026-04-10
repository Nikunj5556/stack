export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface StoreSettings {
  id: string;
  store_name: string;
  logo_url: string | null;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  guest_checkout_enabled: boolean;
  account_creation_required: boolean;
  tax_inclusive_pricing: boolean;
  auto_invoice_generation: boolean;
  default_currency: string;
  timezone: string | null;
  created_at: string;
  updated_at: string;
}

export interface StorePolicies {
  id: string;
  store_id: string;
  privacy_policy: string | null;
  refund_policy: string | null;
  terms_and_conditions: string | null;
  shipping_policy: string | null;
  cancellation_policy: string | null;
  license_usage_policy: string | null;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  is_featured: boolean;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  product_type: string;
  status: string;
  short_description: string | null;
  full_description: string | null;
  brand: string | null;
  publisher: string | null;
  category_id: string | null;
  tags: string[];
  base_price: number;
  compare_at_price: number | null;
  discount_eligible: boolean;
  bundle_price: number | null;
  sku: string | null;
  stock_quantity: number;
  unlimited_stock: boolean;
  purchase_limit: number | null;
  release_date: string | null;
  expiry_date: string | null;
  seo_title: string | null;
  seo_description: string | null;
  requirements: Json;
  compatibility: Json;
  custom_fields: Json;
  avg_rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  url: string;
  media_type: "image" | "video";
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  variant_name: string;
  sku: string | null;
  price: number | null;
  compare_at_price: number | null;
  stock_quantity: number;
  unlimited_stock: boolean;
  attributes: Json;
  is_active: boolean;
  created_at: string;
}

export interface HomepageSection {
  id: string;
  section_key: string;
  product_ids: string[];
  is_active: boolean;
  sort_order: number;
  updated_at: string;
}

export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string | null;
  tags: string[];
  seo_title: string | null;
  seo_description: string | null;
  keywords: string[] | null;
  is_published: boolean;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface HelpArticleRelation {
  id: string;
  article_id: string;
  related_article_id: string;
  relation_type: string;
  sort_order: number;
  created_at: string;
}

export interface HelpArticleFeedback {
  id: string;
  article_id: string;
  is_helpful: boolean;
  user_id: string | null;
  session_id: string | null;
  feedback_text: string | null;
  created_at: string;
}

export interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  tags: string[] | null;
  seo_slug: string | null;
  is_featured: boolean;
  created_at: string;
}

export interface CategoryFeaturedProduct {
  id: string;
  category_id: string;
  product_id: string;
  list_type: "featured" | "best_seller" | "new_arrival" | "trending";
  sort_order: number;
  created_at: string;
}

export interface DigitalFile {
  id: string;
  product_id: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  file_url: string;
  file_version: string;
  upload_date: string;
  access_permissions: Json;
  download_limit: number | null;
  download_expiry_seconds: number | null;
  storage_path: string | null;
  bucket: string | null;
  mime_type: string | null;
  upload_source: string | null;
  owner_staff_id: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  user_id: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string;
  email_verified: boolean;
  phone: string | null;
  phone_verified: boolean;
  password_hash: string | null;
  profile_image: string | null;
  total_orders: number;
  total_spend: number;
  loyalty_tier: string | null;
  notification_prefs: Json;
  created_at: string;
  updated_at: string;
}

export interface UserIdentity {
  id: string;
  customer_id: string;
  provider: string;
  provider_user_id: string;
  email: string | null;
  avatar_url: string | null;
  provider_data: Json;
  linked_at: string;
}

export interface Wallet {
  id: string;
  customer_id: string;
  current_balance: number;
  currency: string;
  lifetime_credited: number;
  lifetime_debited: number;
  last_updated: string;
}

export interface WalletTransaction {
  id: string;
  wallet_id: string;
  type: string;
  amount: number;
  reason: string | null;
  related_order_id: string | null;
  related_payment_id: string | null;
  related_invoice_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface GiftCard {
  id: string;
  gift_code: string;
  balance: number;
  original_amount: number;
  expiry_date: string | null;
  issued_to: string | null;
  redeemed_by: string | null;
  redeemed_at: string | null;
  status: string;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  coupon_type: string;
  discount_value: number;
  max_discount_amount: number | null;
  min_cart_value: number;
  valid_from: string | null;
  valid_until: string | null;
  usage_limit_total: number | null;
  usage_limit_per_customer: number;
  current_usage_count: number;
  applicable_products: string[];
  applicable_categories: string[];
  excluded_products: string[];
  excluded_customers: string[];
  stackable: boolean;
  first_order_only: boolean;
  new_user_only: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  customer_id: string | null;
  status: string;
  currency: string;
  subtotal: number;
  total: number;
  checkout_started: boolean;
  checkout_started_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CheckoutSession {
  id: string;
  cart_id: string | null;
  customer_id: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  billing_address_snapshot: Json;
  shipping_address_snapshot: Json;
  coupon_snapshot: Json;
  order_summary_snapshot: Json;
  payment_method_selected: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string | null;
  guest_customer_data: Json;
  order_status: string;
  payment_status: string;
  fulfillment_status: string;
  delivery_status: string;
  source_channel: string;
  currency: string;
  subtotal: number;
  discount_total: number;
  tax_total: number;
  shipping_total: number;
  fees_total: number;
  grand_total: number;
  name_snapshot: string | null;
  email_snapshot: string | null;
  phone_snapshot: string | null;
  billing_address_snapshot: Json;
  shipping_address_snapshot: Json;
  order_notes: string | null;
  order_tags: string[];
  custom_fields: Json;
  purchase_date: string;
  completion_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id_snapshot: string | null;
  product_name_snapshot: string;
  variant_id_snapshot: string | null;
  variant_name_snapshot: string | null;
  sku_snapshot: string | null;
  quantity: number;
  unit_price: number;
  compare_price: number | null;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
  product_type_snapshot: string | null;
  delivery_method_snapshot: string[] | null;
  access_duration_snapshot: string | null;
  license_tier_snapshot: string | null;
  download_entitlement_snap: Json;
  is_refundable: boolean;
  fulfillment_status: string;
  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string | null;
  customer_id: string | null;
  payment_provider: string;
  provider_payment_id: string | null;
  provider_order_id: string | null;
  payment_method: string | null;
  payment_status: string;
  paid_amount: number;
  currency: string;
  payment_timestamp: string | null;
  failure_reason: string | null;
  gateway_response: Json;
  verification_status: string;
  created_at: string;
  updated_at: string;
}

export interface AccessGrant {
  id: string;
  order_id: string | null;
  order_item_id: string | null;
  customer_id: string | null;
  product_id: string | null;
  digital_file_id: string | null;
  delivery_method: string[] | null;
  delivered_at: string | null;
  delivery_success: boolean | null;
  delivery_failure_reason: string | null;
  download_count: number;
  download_limit: number | null;
  download_expiry_at: string | null;
  first_access_at: string | null;
  last_access_at: string | null;
  file_viewed: boolean;
  access_revoked: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  customer_id: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  subject: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  related_order_id: string | null;
  related_product_id: string | null;
  channel: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_type: string;
  sender_id: string | null;
  message_body: string;
  attachments: string[];
  is_read: boolean;
  sent_at: string;
}

export interface Conversation {
  id: string;
  customer_id: string | null;
  channel: string;
  status: string;
  last_message_at: string | null;
  last_reply_at: string | null;
  created_at: string;
}

export interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string | null;
  attachments: string[];
  delivery_status: string;
  is_read: boolean;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  customer_id: string | null;
  order_id: string | null;
  rating: number;
  title: string | null;
  review_text: string | null;
  is_verified_purchase: boolean;
  helpful_count: number;
  not_helpful_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  media?: ProductReviewMedia[];
  customer?: Pick<Customer, "id" | "first_name" | "last_name" | "full_name" | "profile_image"> | null;
}

export interface ProductReviewMedia {
  id: string;
  review_id: string;
  media_url: string;
  media_type: "image" | "video" | null;
  sort_order: number;
  created_at: string;
}

export interface ProductWithRelations extends Product {
  category?: Category | null;
  categories?: Category | null;
  product_media?: ProductMedia[];
  product_variants?: ProductVariant[];
  digital_files?: DigitalFile[];
}

export interface SupportWorkspaceData {
  customer: Customer;
  conversations: Conversation[];
  conversationMessages: ConversationMessage[];
  tickets: SupportTicket[];
  ticketMessages: TicketMessage[];
}
