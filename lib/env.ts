const optional = (value: string | undefined, fallback = "") => value?.trim() || fallback;

export const env = {
  appName: optional(process.env.NEXT_PUBLIC_STORE_NAME, "Creatorstack"),
  appLogoUrl: optional(
    process.env.NEXT_PUBLIC_STORE_LOGO_URL,
    "https://movieoo.s3.eu-north-1.amazonaws.com/avatars/1775382419468-Creatorstack.png"
  ),
  siteUrl: optional(process.env.NEXT_PUBLIC_SITE_URL, "http://localhost:3000"),
  metaPixelId: optional(process.env.META_PIXEL_ID || process.env.NEXT_PUBLIC_META_PIXEL_ID),
  metaDatasetId: optional(process.env.META_DATASET_ID),
  metaAccessToken: optional(process.env.META_ACCESS_TOKEN),
  metaGraphApiVersion: optional(process.env.META_GRAPH_API_VERSION, "v25.0"),
  smtpHost: optional(process.env.SMTP_HOST),
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpUser: optional(process.env.SMTP_USER),
  smtpPass: optional(process.env.SMTP_PASS),
  smtpSecure: process.env.SMTP_SECURE === "true",
  smtpFromEmail: optional(process.env.SMTP_FROM_EMAIL),
  smtpFromName: optional(process.env.SMTP_FROM_NAME, "Creatorstack"),
  whatsappAccessToken: optional(process.env.META_WHATSAPP_ACCESS_TOKEN),
  whatsappPhoneNumberId: optional(process.env.META_WHATSAPP_PHONE_NUMBER_ID),
  whatsappTemplateName: optional(process.env.META_WHATSAPP_TEMPLATE_NAME),
  whatsappTemplateLanguage: optional(process.env.META_WHATSAPP_TEMPLATE_LANGUAGE, "en_US"),
  supabaseUrl: optional(process.env.NEXT_PUBLIC_SUPABASE_URL, "https://placeholder.supabase.co"),
  supabaseAnonKey: optional(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    "placeholder-anon-key"
  ),
  supabaseServiceRoleKey: optional(process.env.SUPABASE_SERVICE_ROLE_KEY, "placeholder-service-role-key"),
  razorpayKeyId: optional(process.env.RAZORPAY_KEY_ID, "rzp_placeholder"),
  razorpayPublicKeyId: optional(
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID,
    "rzp_placeholder"
  ),
  razorpayKeySecret: optional(process.env.RAZORPAY_KEY_SECRET, "placeholder-secret"),
  fileServiceUrl: optional(
    process.env.APP_RUNNER_FILE_SERVICE_URL,
    "https://aykqayvu7k.us-east-1.awsapprunner.com"
  ),
  isSupabaseConfigured: Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) &&
      process.env.SUPABASE_SERVICE_ROLE_KEY
  ),
  isRazorpayConfigured: Boolean(
    process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET && process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID
  ),
  isMetaConfigured: Boolean(
    process.env.META_ACCESS_TOKEN && (process.env.META_DATASET_ID || process.env.META_PIXEL_ID)
  ),
  isSmtpConfigured: Boolean(
    process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.SMTP_FROM_EMAIL
  ),
  isWhatsAppConfigured: Boolean(
    process.env.META_WHATSAPP_ACCESS_TOKEN &&
      process.env.META_WHATSAPP_PHONE_NUMBER_ID &&
      process.env.META_WHATSAPP_TEMPLATE_NAME
  )
};
