create extension if not exists pgcrypto;

create table if not exists public.user_identities (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  provider text not null,
  provider_user_id text not null,
  email text,
  avatar_url text,
  provider_data jsonb not null default '{}'::jsonb,
  linked_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_user_identities_customer_provider
  on public.user_identities(customer_id, provider);

create unique index if not exists idx_user_identities_provider_user
  on public.user_identities(provider, provider_user_id);

alter table public.product_reviews
  add column if not exists title text,
  add column if not exists review_text text,
  add column if not exists helpful_count integer not null default 0,
  add column if not exists not_helpful_count integer not null default 0,
  add column if not exists status text not null default 'published';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'review_title'
  ) then
    execute 'update public.product_reviews set title = coalesce(title, review_title) where review_title is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'review_body'
  ) then
    execute 'update public.product_reviews set review_text = coalesce(review_text, review_body) where review_body is not null';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'is_visible'
  ) then
    execute 'update public.product_reviews set status = case when is_visible then ''published'' else ''hidden'' end where status is null or status = ''''';
  end if;
end $$;

create table if not exists public.product_review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  media_url text not null,
  media_type text check (media_type in ('image', 'video')),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_product_review_media_review
  on public.product_review_media(review_id, sort_order);

alter table public.products
  add column if not exists avg_rating numeric not null default 0,
  add column if not exists total_reviews integer not null default 0;

create or replace function public.refresh_product_review_stats(target_product_id uuid)
returns void
language plpgsql
as $$
begin
  update public.products
  set
    avg_rating = coalesce((
      select round(avg(rating)::numeric, 2)
      from public.product_reviews
      where product_id = target_product_id
        and status = 'published'
    ), 0),
    total_reviews = (
      select count(*)
      from public.product_reviews
      where product_id = target_product_id
        and status = 'published'
    ),
    updated_at = timezone('utc', now())
  where id = target_product_id;
end;
$$;

create or replace function public.handle_product_review_stats()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_product_review_stats(coalesce(new.product_id, old.product_id));

  if tg_op = 'UPDATE' and old.product_id is distinct from new.product_id then
    perform public.refresh_product_review_stats(old.product_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_product_review_stats on public.product_reviews;
create trigger trg_product_review_stats
after insert or update or delete on public.product_reviews
for each row
execute function public.handle_product_review_stats();

insert into public.user_identities (customer_id, provider, provider_user_id, email, provider_data)
select
  customer_id,
  provider,
  normalized_value,
  case when provider = 'email' then provider_value else null end,
  jsonb_build_object(
    'provider_value', provider_value,
    'normalized_value', normalized_value,
    'verified_at', verified_at
  )
from public.customer_auth_identities
on conflict (customer_id, provider) do update
set
  provider_user_id = excluded.provider_user_id,
  email = coalesce(excluded.email, public.user_identities.email),
  provider_data = excluded.provider_data;

alter table public.customer_sessions
  drop constraint if exists customer_sessions_auth_method_check;

alter table public.customer_sessions
  add constraint customer_sessions_auth_method_check
  check (auth_method in ('email_otp', 'whatsapp_otp', 'google_oauth', 'github_oauth'));
