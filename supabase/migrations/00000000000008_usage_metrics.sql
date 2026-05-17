create table if not exists public.ai_usage_events (
  id bigserial primary key,
  provider text not null check (provider in ('gemini', 'elevenlabs')),
  route text not null,
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  total_tokens integer not null default 0,
  characters integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  cost_idr numeric(14, 2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_events_provider_created_at_idx
  on public.ai_usage_events(provider, created_at desc);

create index if not exists ai_usage_events_route_created_at_idx
  on public.ai_usage_events(route, created_at desc);
