-- Sono: um registro por noite e o resultado dos questionários de sono.

-- "night" é o dia em que a pessoa acordou (a noite de 25 para 26 é a noite 26).
create table public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  night date not null,
  bedtime timestamptz not null,
  wake_time timestamptz not null,
  -- Minutos até pegar no sono e minutos acordado no meio da noite (estimativas da pessoa).
  latency_min integer not null default 0 check (latency_min between 0 and 240),
  awake_min integer not null default 0 check (awake_min between 0 and 480),
  quality smallint check (quality between 1 and 5),
  source text not null default 'manual' check (source in ('manual', 'apple_health')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (wake_time - bedtime between interval '1 hour' and interval '16 hours'),
  check (night = (wake_time at time zone 'America/Sao_Paulo')::date),
  unique (user_id, night, source)
);
create index sleep_logs_user_night on public.sleep_logs (user_id, night desc);

create trigger sleep_logs_touch before update on public.sleep_logs
  for each row execute function public.touch_updated_at();

-- Questionários (por ora, STOP-Bang para risco de apneia).
create table public.sleep_screenings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('stop_bang')),
  answers jsonb not null,
  score smallint not null check (score between 0 and 8),
  risk text not null check (risk in ('low', 'intermediate', 'high')),
  taken_at timestamptz not null default now()
);
create index sleep_screenings_user on public.sleep_screenings (user_id, taken_at desc);

alter table public.sleep_logs enable row level security;
alter table public.sleep_screenings enable row level security;

create policy "dono: tudo" on public.sleep_logs for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());
create policy "dono: tudo" on public.sleep_screenings for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());
