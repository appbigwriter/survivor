-- Survivor: esquema inicial (fase 1)
-- Rodar no SQL Editor do Supabase self-hosted ou com `supabase db push`.
-- Regra geral: cada pessoa só lê e escreve as próprias linhas (RLS).
-- O administrador não tem política especial em tabelas de saúde: o painel
-- dele usa a service role no servidor e seleciona só colunas não sensíveis.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null default 'member' check (role in ('member', 'admin')),
  active boolean not null default true,
  sex text check (sex in ('male', 'female')),
  birth_date date,
  height_cm numeric(5, 1) check (height_cm between 100 and 250),
  waist_cm numeric(5, 1),
  goal text check (goal in ('lose', 'maintain', 'gain_muscle', 'gain_weight')),
  target_weight_kg numeric(5, 1) check (target_weight_kg between 30 and 300),
  occupation_activity text check (occupation_activity in ('sedentary', 'active')),
  -- Atividade planejada (alimenta a estimativa de gasto)
  walk_minutes_per_day integer default 0 check (walk_minutes_per_day between 0 and 300),
  strength_sessions_per_week integer default 0 check (strength_sessions_per_week between 0 and 7),
  strength_minutes_per_session integer default 60,
  calisthenics_sessions_per_week integer default 0 check (calisthenics_sessions_per_week between 0 and 7),
  calisthenics_minutes_per_session integer default 30,
  training_location text check (training_location in ('gym', 'home_equipment', 'home_none')),
  training_experience text check (training_experience in ('never', 'stopped', 'current')),
  renal_clearance boolean not null default false,
  invited_by uuid references auth.users (id) on delete set null,
  onboarding_completed_at timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  created_by uuid references auth.users (id) on delete set null,
  max_uses integer not null default 1 check (max_uses between 1 and 500),
  uses integer not null default 0,
  expires_at timestamptz,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Consentimentos (LGPD)
-- ---------------------------------------------------------------------------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('terms', 'health_data')),
  version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, kind, version)
);

-- ---------------------------------------------------------------------------
-- Triagem de saúde e remédios
-- ---------------------------------------------------------------------------
create table public.health_screenings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  answers jsonb not null,
  cautious_mode boolean not null,
  updated_at timestamptz not null default now()
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  dose text,
  drug_ids text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index medications_user_idx on public.medications (user_id);

-- ---------------------------------------------------------------------------
-- Metas diárias (uma linha por recálculo)
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  starts_on date not null default current_date,
  kcal integer not null,
  protein_g integer not null,
  fat_g integer not null,
  carbs_g integer not null,
  fiber_g integer not null,
  water_ml integer,
  sodium_mg integer,
  method text not null check (method in ('initial', 'adaptive', 'manual')),
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index goals_user_idx on public.goals (user_id, starts_on desc, created_at desc);

-- ---------------------------------------------------------------------------
-- Registros diários
-- ---------------------------------------------------------------------------
create table public.weight_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  weight_kg numeric(5, 2) not null check (weight_kg between 30 and 300),
  body_fat_pct numeric(4, 1),
  lean_mass_kg numeric(5, 2),
  source text not null default 'manual' check (source in ('manual', 'apple_health')),
  external_id text,
  unique (user_id, source, external_id)
);
create index weight_logs_user_idx on public.weight_logs (user_id, measured_at desc);

create table public.step_logs (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  source text not null default 'manual' check (source in ('manual', 'apple_health')),
  steps integer not null check (steps between 0 and 200000),
  distance_m integer,
  active_kcal integer,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, source)
);

create table public.bp_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_at timestamptz not null default now(),
  systolic integer not null check (systolic between 60 and 260),
  diastolic integer not null check (diastolic between 30 and 160),
  pulse integer check (pulse between 30 and 220)
);
create index bp_logs_user_idx on public.bp_logs (user_id, measured_at desc);

create table public.symptom_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  logged_at timestamptz not null default now(),
  kind text not null check (kind in ('dizziness', 'fatigue', 'nausea', 'headache', 'pain', 'other')),
  note text
);
create index symptom_logs_user_idx on public.symptom_logs (user_id, logged_at desc);

-- ---------------------------------------------------------------------------
-- Alimentos (tabela TACO e outras fontes) — leitura pública para logados
-- ---------------------------------------------------------------------------
create table public.foods (
  id bigint generated always as identity primary key,
  source text not null check (source in ('taco', 'off', 'custom')),
  source_code text,
  name text not null,
  category text,
  kcal_100g numeric(7, 2) not null,
  protein_100g numeric(6, 2) not null default 0,
  fat_100g numeric(6, 2) not null default 0,
  carbs_100g numeric(6, 2) not null default 0,
  fiber_100g numeric(6, 2) not null default 0,
  sodium_mg_100g numeric(8, 2) not null default 0,
  search tsvector generated always as (to_tsvector('portuguese', name)) stored,
  unique (source, source_code)
);
create index foods_search_idx on public.foods using gin (search);

-- ---------------------------------------------------------------------------
-- Refeições
-- ---------------------------------------------------------------------------
create table public.meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  eaten_at timestamptz not null default now(),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'snack', 'dinner', 'supper')),
  input_mode text not null check (input_mode in ('text', 'photo', 'barcode', 'manual')),
  input_text text,
  photo_path text,
  kcal numeric(7, 1) not null default 0,
  protein_g numeric(6, 1) not null default 0,
  fat_g numeric(6, 1) not null default 0,
  carbs_g numeric(6, 1) not null default 0,
  fiber_g numeric(6, 1) not null default 0,
  sodium_mg numeric(8, 1) not null default 0,
  created_at timestamptz not null default now()
);
create index meals_user_idx on public.meals (user_id, eaten_at desc);

create table public.meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meals (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id bigint references public.foods (id) on delete set null,
  name text not null,
  preparation text,
  grams numeric(7, 1) not null check (grams > 0 and grams <= 5000),
  kcal numeric(7, 1) not null,
  protein_g numeric(6, 1) not null,
  fat_g numeric(6, 1) not null,
  carbs_g numeric(6, 1) not null,
  fiber_g numeric(6, 1) not null,
  sodium_mg numeric(8, 1) not null default 0,
  value_source text not null check (value_source in ('taco', 'off', 'estimated', 'manual'))
);
create index meal_items_meal_idx on public.meal_items (meal_id);

-- ---------------------------------------------------------------------------
-- Uso de IA (custo e limite diário)
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  mode text not null check (mode in ('system', 'own_key')),
  provider text not null,
  model text not null,
  kind text not null check (kind in ('meal_text', 'meal_photo')),
  input_tokens integer,
  output_tokens integer,
  ok boolean not null
);
create index ai_usage_user_idx on public.ai_usage (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Impede que um usuário comum promova a si mesmo ou reative a própria conta.
create or replace function public.protect_profile_admin_fields() returns trigger
language plpgsql as $$
begin
  if auth.role() = 'authenticated' then
    new.role = old.role;
    new.active = old.active;
    new.invited_by = old.invited_by;
  end if;
  return new;
end;
$$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_admin_fields();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.invites enable row level security;
alter table public.consents enable row level security;
alter table public.health_screenings enable row level security;
alter table public.medications enable row level security;
alter table public.goals enable row level security;
alter table public.weight_logs enable row level security;
alter table public.step_logs enable row level security;
alter table public.bp_logs enable row level security;
alter table public.symptom_logs enable row level security;
alter table public.foods enable row level security;
alter table public.meals enable row level security;
alter table public.meal_items enable row level security;
alter table public.ai_usage enable row level security;

-- Conta desativada pelo administrador perde acesso aos dados, mesmo com token válido.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select active from public.profiles where id = auth.uid()), false);
$$;
revoke all on function public.is_active_user() from public, anon;
grant execute on function public.is_active_user() to authenticated, service_role;

-- Perfil: a própria linha (legível mesmo desativada, para o app mostrar o aviso).
-- Inserção é feita pelo servidor no cadastro.
create policy "perfil: ler o próprio" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "perfil: atualizar o próprio" on public.profiles
  for update to authenticated
  using (id = auth.uid() and public.is_active_user())
  with check (id = auth.uid());

-- Convites: nenhum acesso direto; só o servidor (service role).

-- Tabelas de dados pessoais: CRUD só da própria linha.
do $$
declare
  t text;
begin
  foreach t in array array[
    'consents', 'health_screenings', 'medications', 'goals', 'weight_logs',
    'step_logs', 'bp_logs', 'symptom_logs', 'meals', 'meal_items'
  ] loop
    execute format(
      'create policy "dono: tudo" on public.%I for all to authenticated
         using (user_id = auth.uid() and public.is_active_user())
         with check (user_id = auth.uid() and public.is_active_user())', t);
  end loop;
end;
$$;

-- Uso de IA: o dono só lê; a escrita é do servidor.
create policy "uso de IA: ler o próprio" on public.ai_usage
  for select to authenticated using (user_id = auth.uid() and public.is_active_user());

-- Alimentos: leitura para qualquer pessoa logada e ativa.
create policy "alimentos: leitura" on public.foods
  for select to authenticated using (public.is_active_user());

-- Itens de refeição precisam pertencer a uma refeição do mesmo dono.
create policy "itens: refeição do dono" on public.meal_items
  as restrictive for all to authenticated
  using (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.meals m where m.id = meal_id and m.user_id = auth.uid()));
