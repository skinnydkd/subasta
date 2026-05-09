-- ============================================================================
-- Dev seed: 160 fake players (20 per position) so the auction flow can run
-- end-to-end without real squad data. Idempotent via metadata.dev_seed_id.
-- Match the empty 'demo' theme (which has no filter → matches all non-scrub).
-- ============================================================================

insert into public.tags (slug, display_name, category)
values ('demo-2026', 'Demo 2026 (fake)', 'mixed')
on conflict (slug) do nothing;

-- Generate 20 players per position with deterministic synthetic names
-- and market values 50M€ – 250M€. Skip rows that already exist.
with positions as (
	select unnest(array['GK','LB','RB','CB','CM','LW','RW','ST']::position_code[]) as pos
),
firstnames as (
	select unnest(array[
		'Pol','Marc','Joan','Pep','Aleix','Bruno','Carles','Èric','Ferran','Gerard',
		'Hugo','Ivan','Jordi','Lluís','Martí','Nil','Oriol','Pau','Quim','Roger'
	]) as fname,
		generate_series(1, 20) as fi
),
lastnames as (
	select unnest(array[
		'Garcia','Martínez','López','Pérez','Sánchez','Torres','Flores','Cruz',
		'Morales','Ortiz','Ramos','Ruiz','Álvarez','Mendoza','Castro','Vidal',
		'Romero','Navarro','Iglesias','Serra'
	]) as lname,
		generate_series(1, 20) as li
),
plan as (
	select
		p.pos,
		n as idx,
		format('demo-%s-%s', p.pos, n) as seed_id,
		(select fname from firstnames where fi = 1 + (n % 20)) as fname,
		(select lname from lastnames where li = 1 + ((n * 7) % 20)) as lname,
		(50 + (n * 11) % 200) as value_m
	from positions p, generate_series(1, 20) as n
)
insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)
select
	format('%s %s', fname, lname),
	pos,
	(value_m::bigint) * 100000000, -- 1M€ in cents
	false,
	jsonb_build_object('dev_seed_id', seed_id)
from plan
where not exists (
	select 1 from public.players
	where metadata ->> 'dev_seed_id' = plan.seed_id
);

-- Tag every demo-seeded player with 'demo-2026'
insert into public.player_tags (player_id, tag_id)
select p.id, t.id
from public.players p
cross join public.tags t
where t.slug = 'demo-2026'
	and p.metadata ->> 'dev_seed_id' like 'demo-%'
on conflict do nothing;
