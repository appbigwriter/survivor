-- Funções de apoio: convite atômico e busca de alimentos.

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- Reserva uma vaga do convite de forma atômica. Devolve o id do convite ou null.
create or replace function public.claim_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  update public.invites
     set uses = uses + 1
   where code = p_code
     and not revoked
     and uses < max_uses
     and (expires_at is null or expires_at > now())
  returning id into v_id;
  return v_id;
end;
$$;

-- Devolve a vaga quando o cadastro falha depois da reserva.
create or replace function public.release_invite(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.invites set uses = greatest(uses - 1, 0) where id = p_id;
$$;

revoke all on function public.claim_invite(text) from public, anon, authenticated;
revoke all on function public.release_invite(uuid) from public, anon, authenticated;
grant execute on function public.claim_invite(text) to service_role;
grant execute on function public.release_invite(uuid) to service_role;

-- Busca de alimentos por semelhança de texto (sem acento, sem caixa).
create or replace function public.search_foods(q text, max_results integer default 5)
returns table (
  id bigint,
  source text,
  name text,
  kcal_100g numeric,
  protein_100g numeric,
  fat_100g numeric,
  carbs_100g numeric,
  fiber_100g numeric,
  sodium_mg_100g numeric,
  score real
)
language sql
stable
set search_path = public, extensions
as $$
  select f.id, f.source, f.name, f.kcal_100g, f.protein_100g, f.fat_100g,
         f.carbs_100g, f.fiber_100g, f.sodium_mg_100g,
         similarity(lower(unaccent(f.name)), lower(unaccent(q))) as score
    from public.foods f
   where lower(unaccent(f.name)) % lower(unaccent(q))
      or f.search @@ websearch_to_tsquery('portuguese', q)
   order by score desc
   limit max_results;
$$;

grant execute on function public.search_foods(text, integer) to authenticated, service_role;
