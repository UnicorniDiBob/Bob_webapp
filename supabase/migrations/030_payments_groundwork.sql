-- 030_payments_groundwork.sql
-- Payments groundwork (DORMANT). Data model + RLS only — NO app code, NO Stripe
-- keys, NO live connection. Prepares booking payments, payouts, subscriptions,
-- refunds/disputes and Connect accounts so wiring in 2027 sits on a correct schema.
-- See docs/Bob_Instant_Booking_Spec.md §7 and docs/Bob_Pro_Offers_Strategy.md §6.
--
-- Money: integer cents + currency (Stripe-native, no float drift).
-- Writes happen ONLY server-side via the service role (Stripe webhooks), so these
-- tables intentionally have RLS SELECT policies for owners and NO write policies.
-- Retention: financial rows must survive account deletion (de-identified), so
-- FKs to users/professionals use ON DELETE SET NULL, not cascade.
-- Idempotent: safe to re-run.

begin;

-- ============================================================================
-- 1. Stripe Connect account per professionista (stato onboarding)
-- ============================================================================
create table if not exists public.pro_payment_accounts (
  id uuid primary key default extensions.uuid_generate_v4(),
  professional_id uuid not null unique references public.professionals(id) on delete cascade,
  provider text not null default 'stripe',
  provider_account_id text,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  onboarding_status text not null default 'not_started'
    check (onboarding_status in ('not_started','pending','complete','restricted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================================
-- 2. Abbonamenti pro (Bob Pro / Business) — Stripe Billing
--    professionals.subscription_tier resta il mirror "effettivo" per gli entitlement.
-- ============================================================================
create table if not exists public.subscriptions (
  id uuid primary key default extensions.uuid_generate_v4(),
  professional_id uuid not null unique references public.professionals(id) on delete cascade,
  tier text not null default 'free' check (tier in ('free','pro','business')),
  status text not null default 'incomplete'
    check (status in ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid')),
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_subscriptions_pro on public.subscriptions(professional_id);

-- ============================================================================
-- 3. Fatture di abbonamento (Bob → pro). Dato fiscale: conservare 10 anni.
-- ============================================================================
create table if not exists public.subscription_invoices (
  id uuid primary key default extensions.uuid_generate_v4(),
  subscription_id uuid references public.subscriptions(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'eur',
  status text not null default 'draft'
    check (status in ('draft','open','paid','void','uncollectible')),
  provider text not null default 'stripe',
  provider_invoice_id text,
  period_start timestamptz,
  period_end timestamptz,
  issued_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_sub_invoices_pro on public.subscription_invoices(professional_id);

-- ============================================================================
-- 4. Pagamenti prenotazioni (pay-at-booking + escrow opzionale)
-- ============================================================================
create table if not exists public.payments (
  id uuid primary key default extensions.uuid_generate_v4(),
  appointment_id uuid references public.appointments(id) on delete set null,
  customer_id uuid references public.users(id) on delete set null,
  professional_id uuid references public.professionals(id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'eur',
  application_fee_cents bigint not null default 0 check (application_fee_cents >= 0),
  status text not null default 'requires_payment'
    check (status in ('requires_payment','processing','succeeded','failed','canceled','refunded','partially_refunded')),
  escrow_state text check (escrow_state in ('held','released','refunded')),
  provider text not null default 'stripe',
  provider_payment_intent_id text,
  provider_charge_id text,
  captured_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_payments_customer on public.payments(customer_id);
create index if not exists idx_payments_pro on public.payments(professional_id);
create index if not exists idx_payments_appointment on public.payments(appointment_id);

-- ============================================================================
-- 5. Rimborsi (sotto-record di un pagamento)
-- ============================================================================
create table if not exists public.refunds (
  id uuid primary key default extensions.uuid_generate_v4(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'eur',
  reason text,
  status text not null default 'pending'
    check (status in ('pending','succeeded','failed','canceled')),
  provider_refund_id text,
  created_at timestamptz not null default now()
);
create index if not exists idx_refunds_payment on public.refunds(payment_id);

-- ============================================================================
-- 6. Contestazioni / chargeback (sotto-record di un pagamento)
-- ============================================================================
create table if not exists public.disputes (
  id uuid primary key default extensions.uuid_generate_v4(),
  payment_id uuid not null references public.payments(id) on delete cascade,
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'eur',
  reason text,
  status text not null default 'open'
    check (status in ('open','under_review','won','lost','canceled')),
  provider_dispute_id text,
  evidence_due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_disputes_payment on public.disputes(payment_id);

-- ============================================================================
-- 7. Payout ai pro (Stripe Connect transfer/payout)
-- ============================================================================
create table if not exists public.payouts (
  id uuid primary key default extensions.uuid_generate_v4(),
  professional_id uuid references public.professionals(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  amount_cents bigint not null check (amount_cents >= 0),
  currency text not null default 'eur',
  status text not null default 'pending'
    check (status in ('pending','in_transit','paid','failed','reversed','canceled')),
  provider_transfer_id text,
  provider_payout_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_payouts_pro on public.payouts(professional_id);

-- ============================================================================
-- 8. RLS — owner read-only. Tutte le scritture passano dal service role
--    (webhook Stripe), quindi NESSUNA policy di insert/update/delete.
-- ============================================================================
alter table public.pro_payment_accounts enable row level security;
alter table public.subscriptions enable row level security;
alter table public.subscription_invoices enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.disputes enable row level security;
alter table public.payouts enable row level security;

-- Pro: legge i propri record.
drop policy if exists pro_payment_accounts_select on public.pro_payment_accounts;
create policy pro_payment_accounts_select on public.pro_payment_accounts
  for select using (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );

drop policy if exists subscriptions_select on public.subscriptions;
create policy subscriptions_select on public.subscriptions
  for select using (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );

drop policy if exists subscription_invoices_select on public.subscription_invoices;
create policy subscription_invoices_select on public.subscription_invoices
  for select using (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );

drop policy if exists payouts_select on public.payouts;
create policy payouts_select on public.payouts
  for select using (
    professional_id in (select id from public.professionals where user_id = auth.uid())
  );

-- Pagamenti: li leggono sia il cliente sia il pro coinvolti.
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments
  for select using (
    customer_id = auth.uid()
    or professional_id in (select id from public.professionals where user_id = auth.uid())
  );

-- Rimborsi/contestazioni: visibili a chi può vedere il pagamento collegato.
drop policy if exists refunds_select on public.refunds;
create policy refunds_select on public.refunds
  for select using (
    payment_id in (
      select p.id from public.payments p
      where p.customer_id = auth.uid()
         or p.professional_id in (select id from public.professionals where user_id = auth.uid())
    )
  );

drop policy if exists disputes_select on public.disputes;
create policy disputes_select on public.disputes
  for select using (
    payment_id in (
      select p.id from public.payments p
      where p.customer_id = auth.uid()
         or p.professional_id in (select id from public.professionals where user_id = auth.uid())
    )
  );

commit;
