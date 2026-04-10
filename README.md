# Creatorstack Storefront

Creatorstack is a production-oriented digital ecommerce storefront built for your Supabase schema, Razorpay payment capture flow, and AWS App Runner file service.

## What is included

- Next.js App Router storefront with real catalog/category/product pages
- Supabase-backed customer auth built on the `customers` table
- SMTP email OTP + Meta WhatsApp OTP verification with DB-backed rate limits
- Google and GitHub OAuth sign-in with account linking and duplicate-customer merge logic
- Guest checkout verification that links later sign-ins back to matching orders
- Razorpay checkout verification on the server
- Wallet top-ups capped to INR 10,000 per transaction
- Gift card and coupon support in checkout calculation
- Protected download streaming via `access_grants` + the AWS App Runner `/download` endpoint
- Realtime support workspace for `conversations`, `conversation_messages`, `support_tickets`, and `ticket_messages`
- Review submission with media attachments uploaded through AWS presigned URLs

## Environment variables

Copy `.env.example` to `.env.local` and fill in the keys:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `APP_RUNNER_FILE_SERVICE_URL`
- `NEXT_PUBLIC_SITE_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME`
- `META_WHATSAPP_ACCESS_TOKEN`
- `META_WHATSAPP_PHONE_NUMBER_ID`
- `META_WHATSAPP_TEMPLATE_NAME`
- `META_WHATSAPP_TEMPLATE_LANGUAGE`

## Supabase setup

1. Apply your provided schema.
2. Apply `supabase/migrations/20260407_add_product_reviews.sql` to add the missing review table used by this storefront.
3. Apply `supabase/migrations/20260408_add_customer_auth.sql` to add OTP, session, identity, and rate-limit tables.
4. Apply `supabase/migrations/20260409_add_oauth_identities_and_review_media.sql` to add OAuth identities, review media, and product rating rollups.
5. In Supabase Auth, set your OAuth redirect URL to your site callback route. Providers first redirect to Supabase, and Supabase should redirect back to your storefront callback.
   Example storefront callback: `/api/auth/callback`
6. Enable Realtime on these tables in Supabase:
   - `customers`
   - `conversations`
   - `conversation_messages`
   - `support_tickets`
   - `ticket_messages`

## Run locally

```bash
npm install
npm run dev
```

## Important production note

Your current AWS upload service sets uploaded S3 files to `public-read`. The storefront protects access by only surfacing download streams to customers with valid `access_grants`, but for strict commercial-grade content protection the App Runner upload service should eventually stop making protected product files public at the bucket level.
