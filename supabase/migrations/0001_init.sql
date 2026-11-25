-- AgentForge AI — initial schema (PostgreSQL 15+ / Supabase)
-- Money: integer minor units + ISO currency. Timestamps: timestamptz.
-- Row-level security: customers see only their own / their organisation's rows.
-- Server-side code uses the service role for webhooks, fulfilment and admin jobs.

-- gen_random_uuid() is built into PostgreSQL 13+; no pgcrypto needed.
create extension if not exists vector;

-- ───────────── Enums ─────────────
create type product_status as enum ('draft','coming_soon','beta','published','unavailable','archived');
create type delivery_type  as enum ('hosted-tool','cloud-agent','self-hosted-agent','workflow-template','source-code','subscription');
create type license_type   as enum ('personal','commercial','developer','agency','white-label');
create type order_status   as enum ('pending','paid','refunded','partially_refunded','expired','failed');
create type refund_status  as enum ('requested','approved','rejected','succeeded');
create type member_role    as enum ('owner','admin','member');
create type run_status     as enum ('running','paused','awaiting_approval','completed','failed','cancelled');

-- ───────────── Identity & tenancy ─────────────
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(full_name) between 1 and 120),
  platform_role text not null default 'customer' check (platform_role in ('customer','admin')),
  marketing_consent boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  owner_id uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table organization_members (
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role member_role not null default 'member',
  primary key (organization_id, user_id)
);

create table roles (id text primary key, description text not null);
create table permissions (id text primary key, description text not null);
create table role_permissions (role_id text references roles(id) on delete cascade, permission_id text references permissions(id) on delete cascade, primary key (role_id, permission_id));

-- ───────────── Catalogue ─────────────
create table categories (
  slug text primary key,
  name text not null,
  nav_label text not null,
  tagline text not null,
  description text not null,
  accent text not null,
  sort_order int not null default 0
);

create table sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  display_name text not null,
  status text not null default 'submitted' check (status in ('submitted','verified','rejected','suspended')),
  commission_bps int not null default 0 check (commission_bps between 0 and 10000),
  payouts_enabled boolean not null default false, -- stays false until a compliant marketplace payment solution is configured
  created_at timestamptz not null default now()
);

create table products (
  id text primary key,
  slug text not null unique,
  seller_id uuid references sellers(id), -- null = first-party
  category_slug text not null references categories(slug),
  subcategory text not null,
  title text not null,
  short_description text not null,
  description text not null,
  price_amount int not null check (price_amount between 1000 and 80000),
  currency char(3) not null default 'EUR',
  status product_status not null default 'draft',
  functional boolean not null default false,
  delivery delivery_type not null,
  hosting text not null check (hosting in ('hosted','self-hosted','both')),
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  license license_type not null,
  version text not null default '0.0.0',
  cost_per_run_low numeric(10,4),
  cost_per_run_high numeric(10,4),
  cost_note text,
  benefits text[] not null default '{}',
  use_cases text[] not null default '{}',
  audience text[] not null default '{}',
  industries text[] not null default '{}',
  inputs text[] not null default '{}',
  outputs text[] not null default '{}',
  requirements text[] not null default '{}',
  installation text[] not null default '{}',
  providers text[] not null default '{}',
  demo_available boolean not null default false,
  seo_title text, seo_description text, seo_keywords text[],
  search tsvector generated always as (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(short_description,'') || ' ' || coalesce(description,''))) stored,
  published_at timestamptz,
  updated_at timestamptz not null default now(),
  -- Products cannot be sold without an implemented, tested deliverable.
  constraint purchasable_requires_deliverable check (status not in ('published','beta') or functional)
);
create index products_category_idx on products(category_slug, status);
create index products_price_idx on products(price_amount);
create index products_search_idx on products using gin(search);
create index products_industries_idx on products using gin(industries);

create table product_images (id uuid primary key default gen_random_uuid(), product_id text not null references products(id) on delete cascade, src text not null, alt text not null, kind text not null check (kind in ('illustration','diagram','screenshot')), sort_order int not null default 0);
create table product_versions (id uuid primary key default gen_random_uuid(), product_id text not null references products(id) on delete cascade, version text not null, released_at timestamptz not null default now(), notes text[] not null default '{}', unique (product_id, version));
create table product_files (id uuid primary key default gen_random_uuid(), version_id uuid not null references product_versions(id) on delete cascade, storage_path text not null, bytes bigint not null, sha256 text not null);
create table product_features (id uuid primary key default gen_random_uuid(), product_id text not null references products(id) on delete cascade, feature text not null, sort_order int not null default 0);
create table product_integrations (product_id text not null references products(id) on delete cascade, integration text not null, primary key (product_id, integration));
create table product_licenses (product_id text not null references products(id) on delete cascade, license license_type not null, price_amount int not null check (price_amount > 0), primary key (product_id, license));
create table product_faqs (id uuid primary key default gen_random_uuid(), product_id text not null references products(id) on delete cascade, question text not null, answer text not null, sort_order int not null default 0);
create table product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  rating int not null check (rating between 1 and 5),
  title text not null, body text not null,
  created_at timestamptz not null default now(),
  unique (product_id, user_id)
);

-- ───────────── Commerce ─────────────
create table coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9_-]{3,40}$'),
  kind text not null check (kind in ('percent','fixed')),
  value int not null check (value > 0),
  currency char(3) not null default 'EUR',
  active boolean not null default true,
  min_subtotal int, max_redemptions int, redemptions int not null default 0,
  product_ids text[], expires_at timestamptz,
  created_at timestamptz not null default now(),
  check (kind <> 'percent' or value <= 100)
);

create table cart_items (
  owner_key text not null, -- user id or anonymous cookie id
  product_id text not null references products(id) on delete cascade,
  quantity int not null default 1 check (quantity between 1 and 50),
  license license_type not null,
  added_at timestamptz not null default now(),
  primary key (owner_key, product_id)
);

create table wishlists (user_id uuid not null references profiles(id) on delete cascade, product_id text not null references products(id) on delete cascade, added_at timestamptz not null default now(), primary key (user_id, product_id));

create table orders (
  id text primary key,
  number text unique,
  user_id uuid not null references profiles(id),
  organization_id uuid references organizations(id),
  email text not null,
  status order_status not null default 'pending',
  subtotal_amount int not null, discount_amount int not null default 0, tax_amount int not null default 0, total_amount int not null,
  tax_rate numeric(5,2) not null default 0, tax_note text,
  currency char(3) not null default 'EUR',
  country char(2) not null, vat_id text,
  coupon_id uuid references coupons(id),
  provider text not null, provider_session_id text, payment_ref text,
  digital_consent boolean not null,
  refunded_amount int not null default 0,
  created_at timestamptz not null default now(), paid_at timestamptz,
  check (total_amount = subtotal_amount - discount_amount + tax_amount)
);
create index orders_user_idx on orders(user_id, created_at desc);

create table order_items (id uuid primary key default gen_random_uuid(), order_id text not null references orders(id) on delete cascade, product_id text not null references products(id), title text not null, unit_amount int not null, quantity int not null check (quantity > 0), license license_type not null);

create table payments (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders(id),
  provider text not null,
  provider_event_id text not null unique, -- idempotency: each provider event processed once
  type text not null,
  amount int not null, currency char(3) not null,
  processed_at timestamptz not null default now()
);

create table refunds (id uuid primary key default gen_random_uuid(), order_id text not null references orders(id), user_id uuid not null references profiles(id), reason text not null, amount int not null check (amount > 0), status refund_status not null default 'requested', provider_ref text, decided_by uuid references profiles(id), created_at timestamptz not null default now(), decided_at timestamptz);

create table entitlements (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id), organization_id uuid references organizations(id), order_id text not null references orders(id), product_id text not null references products(id), license license_type not null, status text not null default 'active' check (status in ('active','revoked')), created_at timestamptz not null default now());
create index entitlements_user_idx on entitlements(user_id, product_id) where status = 'active';

create table license_keys (key text primary key, entitlement_id uuid not null references entitlements(id) on delete cascade, user_id uuid not null references profiles(id), product_id text not null references products(id), license license_type not null, status text not null default 'active' check (status in ('active','revoked')), activations int not null default 0, created_at timestamptz not null default now());
create table downloads (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id), product_id text not null references products(id), version text not null, at timestamptz not null default now());
create table subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id), product_id text not null references products(id), provider_subscription_id text unique, status text not null, current_period_end timestamptz, cancel_at_period_end boolean not null default false, created_at timestamptz not null default now());
create table usage_credits (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id), delta int not null, reason text not null, execution_id uuid, at timestamptz not null default now());
create index usage_credits_user_idx on usage_credits(user_id);

-- ───────────── AI runtime ─────────────
create table ai_providers (id text primary key check (id in ('openai','anthropic','gemini')), enabled boolean not null default true, updated_at timestamptz not null default now());
create table integration_connections (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, provider text not null, ciphertext text not null, last4 text not null, created_at timestamptz not null default now(), unique (user_id, provider));

create table knowledge_bases (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, organization_id uuid references organizations(id), name text not null, created_at timestamptz not null default now());
create table documents (id uuid primary key default gen_random_uuid(), knowledge_base_id uuid not null references knowledge_bases(id) on delete cascade, user_id uuid not null references profiles(id) on delete cascade, name text not null, bytes int not null, pages text[] not null, created_at timestamptz not null default now());
create table embeddings (id bigserial primary key, document_id uuid not null references documents(id) on delete cascade, user_id uuid not null references profiles(id) on delete cascade, page int, chunk text not null, embedding vector(1536));
create index embeddings_vec_idx on embeddings using hnsw (embedding vector_cosine_ops);

create table agent_configurations (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, product_id text not null references products(id), name text not null, instructions text not null, model text not null, tools text[] not null default '{}', knowledge_base_id uuid references knowledge_bases(id) on delete set null, memory boolean not null default false, memory_notes text[] not null default '{}', schedule text not null default 'off' check (schedule in ('off','hourly','daily','weekly')), schedule_input text not null default '', last_scheduled_at timestamptz, webhook_token text not null unique, allowed_hosts text[] not null default '{}', updated_at timestamptz not null default now());
create table workflows (id uuid primary key default gen_random_uuid(), agent_configuration_id uuid not null references agent_configurations(id) on delete cascade, graph jsonb not null, version int not null default 1, updated_at timestamptz not null default now());

create table agent_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  anon_key text,
  product_id text not null references products(id),
  agent_configuration_id uuid references agent_configurations(id) on delete set null,
  mode text not null check (mode in ('demo','owned','api','studio')),
  status text not null,
  provider text not null, model text not null,
  input_preview text, output text, error text,
  input_tokens int not null default 0, output_tokens int not null default 0,
  cost_eur numeric(12,6) not null default 0, credits int not null default 0,
  simulated boolean not null default false,
  duration_ms int,
  created_at timestamptz not null default now()
);
create index agent_executions_user_idx on agent_executions(user_id, created_at desc);

create table execution_steps (id bigserial primary key, execution_id uuid not null references agent_executions(id) on delete cascade, step_id text not null, label text not null, agent text, status text not null, duration_ms int, tokens int, detail text, approved_by uuid references profiles(id), at timestamptz not null default now());

create table api_keys (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, name text not null, prefix text not null, key_hash text not null unique, created_at timestamptz not null default now(), last_used_at timestamptz, revoked_at timestamptz);
create table webhooks (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, url text not null check (url like 'https://%'), secret_hash text not null, events text[] not null, active boolean not null default true, created_at timestamptz not null default now());

-- ───────────── Growth, support, platform ─────────────
create table seller_earnings (id uuid primary key default gen_random_uuid(), seller_id uuid not null references sellers(id), order_item_id uuid not null references order_items(id), gross_amount int not null, commission_amount int not null, net_amount int not null, payout_id text, created_at timestamptz not null default now());
create table affiliate_referrals (id uuid primary key default gen_random_uuid(), code text not null unique, owner_id uuid not null references profiles(id), clicks int not null default 0, conversions int not null default 0, created_at timestamptz not null default now());
create table support_tickets (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id), subject text not null, status text not null default 'open' check (status in ('open','answered','closed')), messages jsonb not null default '[]', created_at timestamptz not null default now());
create table notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles(id) on delete cascade, title text not null, body text not null, href text, read_at timestamptz, created_at timestamptz not null default now());
create table blog_posts (slug text primary key, title text not null, excerpt text not null, body text not null, tag text not null, published_at date not null);
create table newsletter_subscribers (email text primary key, consent_at timestamptz not null, source text not null);
create table audit_logs (id bigserial primary key, actor_id uuid, action text not null, target text not null, meta jsonb, at timestamptz not null default now());
create index audit_logs_at_idx on audit_logs(at desc);
create table platform_settings (key text primary key, value jsonb not null, updated_at timestamptz not null default now());

-- Audit logs are append-only, even for the service role via SQL.
create or replace function forbid_audit_mutation() returns trigger language plpgsql as $$ begin raise exception 'audit_logs is append-only'; end $$;
create trigger audit_logs_no_update before update or delete on audit_logs for each row execute function forbid_audit_mutation();

-- ───────────── Row-level security ─────────────
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and platform_role = 'admin' and deleted_at is null)
$$;

alter table profiles enable row level security;
alter table organizations enable row level security;
alter table organization_members enable row level security;
alter table products enable row level security;
alter table product_images enable row level security;
alter table product_reviews enable row level security;
alter table categories enable row level security;
alter table wishlists enable row level security;
alter table cart_items enable row level security;
alter table orders enable row level security;
alter table order_items enable row level security;
alter table payments enable row level security;
alter table refunds enable row level security;
alter table entitlements enable row level security;
alter table license_keys enable row level security;
alter table downloads enable row level security;
alter table subscriptions enable row level security;
alter table usage_credits enable row level security;
alter table integration_connections enable row level security;
alter table knowledge_bases enable row level security;
alter table documents enable row level security;
alter table embeddings enable row level security;
alter table agent_configurations enable row level security;
alter table workflows enable row level security;
alter table agent_executions enable row level security;
alter table execution_steps enable row level security;
alter table api_keys enable row level security;
alter table webhooks enable row level security;
alter table support_tickets enable row level security;
alter table notifications enable row level security;
alter table coupons enable row level security;
alter table audit_logs enable row level security;
alter table platform_settings enable row level security;
alter table sellers enable row level security;
alter table seller_earnings enable row level security;
alter table affiliate_referrals enable row level security;
alter table newsletter_subscribers enable row level security;
alter table blog_posts enable row level security;

-- Public catalogue reads
create policy "catalogue readable" on products for select using (status not in ('draft','archived') or is_admin());
create policy "categories readable" on categories for select using (true);
create policy "images readable" on product_images for select using (true);
create policy "reviews readable" on product_reviews for select using (true);
create policy "blog readable" on blog_posts for select using (true);
-- Verified-purchase reviews only
create policy "review own purchase" on product_reviews for insert with check (
  user_id = auth.uid() and exists (select 1 from entitlements e where e.user_id = auth.uid() and e.product_id = product_reviews.product_id and e.status = 'active'));
create policy "edit own review" on product_reviews for update using (user_id = auth.uid());

-- Own profile
create policy "own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "update own profile" on profiles for update using (id = auth.uid()) with check (id = auth.uid() and platform_role = (select platform_role from profiles where id = auth.uid()));

-- Organisations: members read, owners update
create policy "member reads org" on organizations for select using (exists (select 1 from organization_members m where m.organization_id = id and m.user_id = auth.uid()) or is_admin());
create policy "owner updates org" on organizations for update using (owner_id = auth.uid());
create policy "member reads membership" on organization_members for select using (user_id = auth.uid() or exists (select 1 from organization_members m where m.organization_id = organization_members.organization_id and m.user_id = auth.uid() and m.role in ('owner','admin')));

-- Owner-only tables (customer reads/writes own rows; admins read)
do $$
declare t text;
begin
  foreach t in array array['wishlists','knowledge_bases','documents','embeddings','agent_configurations','api_keys','webhooks','notifications','integration_connections'] loop
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy "admin reads" on %I for select using (is_admin())', t);
  end loop;
  -- Read-only for customers: written only by the server (service role) after verified events.
  foreach t in array array['orders','refunds','entitlements','license_keys','downloads','subscriptions','usage_credits','agent_executions','support_tickets'] loop
    execute format('create policy "own rows read" on %I for select using (user_id = auth.uid() or is_admin())', t);
  end loop;
end $$;

create policy "own order items" on order_items for select using (exists (select 1 from orders o where o.id = order_id and (o.user_id = auth.uid() or is_admin())));
create policy "own workflow" on workflows for all using (exists (select 1 from agent_configurations c where c.id = agent_configuration_id and c.user_id = auth.uid()));
create policy "own steps" on execution_steps for select using (exists (select 1 from agent_executions e where e.id = execution_id and (e.user_id = auth.uid() or is_admin())));
create policy "refund request" on refunds for insert with check (user_id = auth.uid() and status = 'requested');
create policy "ticket create" on support_tickets for insert with check (user_id = auth.uid());

-- Admin-only tables
create policy "admin all coupons" on coupons for all using (is_admin()) with check (is_admin());
create policy "admin reads audit" on audit_logs for select using (is_admin());
create policy "admin settings" on platform_settings for all using (is_admin()) with check (is_admin());
create policy "admin payments" on payments for select using (is_admin());
create policy "admin sellers" on sellers for all using (is_admin() or user_id = auth.uid());
create policy "admin earnings" on seller_earnings for select using (is_admin() or exists (select 1 from sellers s where s.id = seller_id and s.user_id = auth.uid()));
create policy "admin newsletter" on newsletter_subscribers for select using (is_admin());
create policy "own referrals" on affiliate_referrals for select using (owner_id = auth.uid() or is_admin());
-- cart_items are keyed by owner_key (user or anon cookie); accessed only through the server.
