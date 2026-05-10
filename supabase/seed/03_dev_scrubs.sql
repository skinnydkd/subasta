-- ============================================================================
-- Dev seed: scrub players (8 per position = 64 total) used to fill empty
-- slots after the auction queue ends. Marked is_scrub=true so the regular
-- auction queue ignores them (start_room filters with is_scrub=false).
-- Idempotent via metadata.dev_seed_id like 'scrub-%'.
-- ============================================================================

with positions as (
	select unnest(array['GK','LB','RB','CB','CM','LW','RW','ST']::position_code[]) as pos
),
plan as (
	select
		p.pos,
		n as idx,
		format('scrub-%s-%s', p.pos, n) as seed_id,
		format('Scrub %s%s', p.pos, lpad(n::text, 2, '0')) as fullname
	from positions p, generate_series(1, 8) as n
)
insert into public.players (name, primary_position, market_value_cents, is_scrub, metadata)
select
	fullname,
	pos,
	null, -- no market value for scrubs
	true,
	jsonb_build_object('dev_seed_id', seed_id)
from plan
where not exists (
	select 1 from public.players
	where metadata ->> 'dev_seed_id' = plan.seed_id
);
