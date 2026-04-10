create extension if not exists pgcrypto;

create table if not exists public.customer_auth_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  provider text not null check (provider in ('email', 'phone')),
  provider_value text not null,
  normalized_value text not null,
  verified_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (provider, normalized_value)
);

create index if not exists idx_customer_auth_identities_customer on public.customer_auth_identities(customer_id);

create table if not exists public.customer_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  purpose text not null check (purpose in ('account_access', 'guest_checkout')),
  channel text not null check (channel in ('email', 'whatsapp')),
  target text not null,
  target_normalized text not null,
  otp_hash text not null,
  requested_ip text,
  requested_user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  expires_at timestamptz not null,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_customer_otp_lookup
  on public.customer_otp_challenges(channel, target_normalized, created_at desc);

create table if not exists public.customer_sessions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  token_hash text not null unique,
  auth_method text not null check (auth_method in ('email_otp', 'whatsapp_otp')),
  created_at timestamptz not null default timezone('utc', now()),
  last_seen_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null
);

create index if not exists idx_customer_sessions_customer on public.customer_sessions(customer_id);
create index if not exists idx_customer_sessions_expiry on public.customer_sessions(expires_at);

create table if not exists public.auth_rate_limits (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  bucket_key text not null,
  window_starts_at timestamptz not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (action, bucket_key, window_starts_at)
);

create index if not exists idx_auth_rate_limits_lookup
  on public.auth_rate_limits(action, bucket_key, window_starts_at desc);
