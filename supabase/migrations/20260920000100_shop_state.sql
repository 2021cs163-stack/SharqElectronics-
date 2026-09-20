-- The existing app uses nested JSON collections. Preserve those shapes and
-- commit all related collections atomically (e.g. bills + inventory + ledger).
begin;

create table public.shop_state (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  constraint shop_state_object check (jsonb_typeof(data) = 'object')
);
alter table public.shop_state enable row level security;
revoke all on public.shop_state from anon, authenticated;
grant select on public.shop_state to authenticated;
create policy "Owners read their own shop" on public.shop_state
  for select to authenticated using ((select auth.uid()) = owner_id);

-- Writes must go through this function so clients cannot skip version checks.
create function public.save_shop_state(expected_version bigint, next_data jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  new_version bigint;
  item record;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if expected_version is null or expected_version < 0 then
    raise exception 'Invalid version';
  end if;
  if next_data is null or jsonb_typeof(next_data) <> 'object' then
    raise exception 'Shop data must be an object';
  end if;
  for item in select * from jsonb_each(next_data) loop
    if item.key <> all(array[
      'shopshield_tools','shopshield_ledger','shopshield_day_state',
      'shopshield_bills','shopshield_customers','shopshield_service_jobs',
      'shopshield_service_workers','shopshield_worker_txns','shopshield_projects',
      'shopshield_rentals','shopshield_activity_log','shopshield_shop_settings',
      'sharq_expenses','sharq_shopping','sharq_partner_txns',
      'shopshield_txs','shopshield_transactions'
    ]) or jsonb_typeof(item.value) <> 'string' then
      raise exception 'Unsupported shop data key or value: %', item.key;
    end if;
    if item.key = 'shopshield_day_state' then
      if (item.value #>> '{}') not in ('open', 'closed-clean', 'closed-assigned') then
        raise exception 'Invalid day state';
      end if;
    elsif item.key = 'shopshield_shop_settings' then
      if jsonb_typeof((item.value #>> '{}')::jsonb) <> 'object' then
        raise exception 'Settings must be an object';
      end if;
    elsif jsonb_typeof((item.value #>> '{}')::jsonb) <> 'array' then
      raise exception 'Collection must be an array: %', item.key;
    end if;
  end loop;
  if expected_version = 0 then
    insert into public.shop_state(owner_id, data) values(caller, next_data)
      on conflict (owner_id) do nothing returning version into new_version;
  else
    update public.shop_state set data = next_data, version = version + 1, updated_at = now()
      where owner_id = caller and version = expected_version
      returning version into new_version;
  end if;
  if new_version is null then
    raise exception 'Another device updated this shop. Export unsaved changes, then reload.' using errcode = '40001';
  end if;
  return new_version;
end;
$$;
revoke all on function public.save_shop_state(bigint, jsonb) from public, anon;
grant execute on function public.save_shop_state(bigint, jsonb) to authenticated;
commit;
