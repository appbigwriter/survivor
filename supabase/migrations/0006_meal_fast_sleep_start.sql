-- Refeição marcada como a última do dia: o jejum começa nela, mesmo com a
-- janela de alimentação ainda aberta.
alter table public.meals add column if not exists starts_fast boolean not null default false;

-- "Iniciar sono": a hora em que a pessoa foi deitar, até ela tocar em "Acordei".
-- Uma linha por pessoa; some quando a noite é registrada.
create table if not exists public.sleep_starts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  started_at timestamptz not null default now()
);

alter table public.sleep_starts enable row level security;

create policy "dono: tudo" on public.sleep_starts for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());
