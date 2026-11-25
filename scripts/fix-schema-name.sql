-- Corrige o nome do schema criado com erro de digitação (`saas_survidor` -> `saas_survivor`).
--
-- Como executar:
--   1. No SQL Editor do Supabase (cole e execute o script inteiro), ou
--   2. Via psql usando a variável DATABASE_URL:
--        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/fix-schema-name.sql
--
-- O script roda dentro de uma transação: se algo falhar, nada é alterado.

begin;

do $$
declare
  v_old_oid oid;
  v_new_oid oid;
  v_new_has_objects boolean := false;
  v_fn record;
  v_fn_def text;
  v_new_fn_def text;
  v_cfg record;
  v_new_val text;
  v_key_sql text;
  v_schemas text;
begin
  select oid into v_old_oid from pg_namespace where nspname = 'saas_survidor';
  select oid into v_new_oid from pg_namespace where nspname = 'saas_survivor';

  if v_old_oid is null and v_new_oid is null then
    select coalesce(string_agg(nspname, ', ' order by nspname), '(nenhum)')
      into v_schemas
      from pg_namespace
     where nspname not in ('pg_catalog', 'information_schema')
       and nspname not like 'pg\_toast%'
       and nspname not like 'pg\_temp%';

    raise exception 'Nenhum dos schemas ("saas_survidor" ou "saas_survivor") foi encontrado no banco "%". Schemas existentes: %',
      current_database(), v_schemas;
  end if;

  if v_old_oid is null and v_new_oid is not null then
    raise notice 'Schema "saas_survidor" não encontrado e "saas_survivor" já existe. Pulando renomeação e validando referências.';
  else
    if v_new_oid is not null then
      select (
        exists (select 1 from pg_class where relnamespace = v_new_oid)
        or exists (select 1 from pg_proc where pronamespace = v_new_oid)
      ) into v_new_has_objects;

      if v_new_has_objects then
        raise exception 'O schema "saas_survivor" já existe e contém objetos. Renomeação abortada para evitar perda ou conflito de dados.';
      end if;

      raise notice 'Schema "saas_survivor" já existia vazio; removendo para permitir a renomeação.';
      execute 'drop schema saas_survivor';
    end if;

    execute 'alter schema saas_survidor rename to saas_survivor';
    raise notice 'Schema renomeado: "saas_survidor" -> "saas_survivor".';
  end if;

  -- O ALTER SCHEMA RENAME move tabelas, índices, sequências, triggers e políticas RLS,
  -- mas NÃO atualiza o código-fonte nem o `SET search_path` das funções.
  for v_fn in
    select p.oid, n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_language l on l.oid = p.prolang
     where n.nspname not in (
             'pg_catalog', 'information_schema', 'auth', 'storage', 'realtime',
             '_realtime', 'extensions', 'graphql', 'graphql_public', 'pgsodium',
             'vault', 'net', 'supabase_functions'
           )
       and n.nspname not like 'pg\_%'
       and p.prokind in ('f', 'p')
       and l.lanname in ('sql', 'plpgsql')
  loop
    v_fn_def := pg_get_functiondef(v_fn.oid);
    if v_fn_def ~ '\ysaas_survidor\y' then
      v_new_fn_def := regexp_replace(v_fn_def, '\ysaas_survidor\y', 'saas_survivor', 'g');
      execute v_new_fn_def;
      raise notice 'Função atualizada: %.%(%)', v_fn.nspname, v_fn.proname, v_fn.args;
    end if;
  end loop;

  -- Atualiza configurações de roles/banco (ex.: pgrst.db_schemas / search_path) caso apontem para saas_survidor.
  for v_cfg in
    select r.rolname,
           d.datname,
           split_part(cfg, '=', 1) as key,
           substr(cfg, length(split_part(cfg, '=', 1)) + 2) as val
      from pg_db_role_setting s
      left join pg_roles r on r.oid = s.setrole
      left join pg_database d on d.oid = s.setdatabase
      cross join lateral unnest(s.setconfig) as cfg
     where (s.setrole <> 0 or s.setdatabase <> 0)
       and (s.setdatabase = 0 or d.datname = current_database())
       and cfg ~ '\ysaas_survidor\y'
  loop
    v_new_val := regexp_replace(v_cfg.val, '\ysaas_survidor\y', 'saas_survivor', 'g');
    select string_agg(quote_ident(part), '.')
      into v_key_sql
      from unnest(string_to_array(v_cfg.key, '.')) as part;

    begin
      if v_cfg.key = 'search_path' then
        if v_cfg.rolname is null then
          execute format('alter database %I set search_path = %s', v_cfg.datname, v_new_val);
        elsif v_cfg.datname is null then
          execute format('alter role %I set search_path = %s', v_cfg.rolname, v_new_val);
        else
          execute format('alter role %I in database %I set search_path = %s', v_cfg.rolname, v_cfg.datname, v_new_val);
        end if;
      else
        if v_cfg.rolname is null then
          execute format('alter database %I set %s = %L', v_cfg.datname, v_key_sql, v_new_val);
        elsif v_cfg.datname is null then
          execute format('alter role %I set %s = %L', v_cfg.rolname, v_key_sql, v_new_val);
        else
          execute format('alter role %I in database %I set %s = %L', v_cfg.rolname, v_cfg.datname, v_key_sql, v_new_val);
        end if;
      end if;
      raise notice 'Configuração atualizada (%): %', v_cfg.key, v_new_val;
    exception
      when insufficient_privilege then
        raise warning 'Sem permissão para alterar % (role=% / db=%). Atualize manualmente para: %',
          v_cfg.key, coalesce(v_cfg.rolname, '-'), coalesce(v_cfg.datname, '-'), v_new_val;
    end;
  end loop;
end;
$$;

-- Recarrega configuração e cache de schema do PostgREST (Supabase API), se aplicável.
notify pgrst, 'reload config';
notify pgrst, 'reload schema';

commit;

-- Conferência final
select nspname as schema_atual
  from pg_namespace
 where nspname in ('saas_survidor', 'saas_survivor');

select count(*) as total_tabelas_no_schema
  from information_schema.tables
 where table_schema = 'saas_survivor';
