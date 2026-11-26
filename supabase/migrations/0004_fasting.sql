-- Jejum intermitente: as escolhas de cada pessoa e o resultado da triagem.
-- O tempo de jejum não é guardado: o app calcula pelas refeições registradas.
-- "enabled" e "eligibility" são só a escolha gravada: o app refaz a triagem a
-- cada leitura com os dados atuais (remédios, peso, anamnese) e só mostra o
-- jejum se ela ainda permitir. Assim, gravar "eligibility = ok" direto pela API
-- não libera nada.

create table public.fasting_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  enabled boolean not null default false,
  protocol text not null default '12:12' check (protocol in ('12:12', '14:10', '16:8')),
  -- Hora em que a janela de alimentação abre (no fuso de Brasília).
  -- Entre 5h e 16h: a janela de alimentação sempre termina até a meia-noite.
  eating_start time not null default '08:00' check (eating_start between '05:00' and '16:00'),
  -- Respostas da triagem do jejum (gravidez, transtorno alimentar, diabetes).
  answers jsonb not null default '{}',
  eligibility text not null check (eligibility in ('ok', 'needs_clearance', 'blocked')),
  medical_clearance boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Bloqueado nunca fica ativo; quem precisa de liberação só ativa com ela.
  check (not enabled or eligibility = 'ok' or (eligibility = 'needs_clearance' and medical_clearance))
);

create trigger fasting_settings_touch before update on public.fasting_settings
  for each row execute function public.touch_updated_at();

alter table public.fasting_settings enable row level security;

create policy "dono: tudo" on public.fasting_settings for all to authenticated
  using (user_id = auth.uid() and public.is_active_user())
  with check (user_id = auth.uid() and public.is_active_user());
