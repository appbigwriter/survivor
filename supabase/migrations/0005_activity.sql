-- Atividade física (plano da semana e sessões feitas) e o código pessoal que o
-- atalho do iPhone usa para enviar os dados do Apple Saúde.

-- Plano da semana. Dias: 0 = domingo ... 6 = sábado.
create table public.activity_plans (
  user_id uuid primary key references auth.users (id) on delete cascade,
  strength_days smallint[] not null default '{}',
  calisthenics_days smallint[] not null default '{}',
  -- Minutos de caminhada planejados para todos os dias.
  walk_minutes smallint not null default 30 check (walk_minutes between 0 and 180),
  updated_at timestamptz not null default now(),
  check (strength_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  check (calisthenics_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])
);

create trigger activity_plans_touch before update on public.activity_plans
  for each row execute function public.touch_updated_at();

-- Cada sessão feita: caminhada, musculação, calistenia ou outra.
create table public.activity_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  kind text not null check (kind in ('walk', 'strength', 'calisthenics', 'other')),
  minutes smallint not null check (minutes between 1 and 600),
  -- Esforço percebido de 1 (muito leve) a 10 (máximo).
  effort smallint check (effort between 1 and 10),
  notes text check (char_length(notes) <= 500),
  source text not null default 'manual' check (source in ('manual', 'apple_health')),
  -- Identificador do treino no Apple Saúde, para não duplicar no reenvio.
  external_id text,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);
create index activity_sessions_user_day on public.activity_sessions (user_id, day desc);

-- Código pessoal do atalho. Guardamos só o hash; o código aparece uma vez na tela.
-- O endereço que recebe os dados usa a chave de serviço e confere o hash e se a
-- conta está ativa, porque o atalho não tem sessão de login.
create table public.device_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

alter table public.activity_plans enable row level security;
alter table public.activity_sessions enable row level security;
alter table public.device_tokens enable row level security;

create policy "dono: tudo" on public.activity_plans for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());

create policy "dono: tudo" on public.activity_sessions for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());

create policy "dono: tudo" on public.device_tokens for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());
