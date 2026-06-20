// Verifies start_room's queue builder:
//   1. No duplicate real player (lower(name), birth_year) in one room, even for
//      multi-era themes that seed one row per era.
//   2. Resilient: with demand > unique pool (high extra_per_position) it inserts
//      what's available instead of raising 'not enough players'.
//
// Runs inside a transaction that is ROLLED BACK. Usage:
//   node tests/test_start_room_dedup.mjs

import 'dotenv/config';
import pg from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
	console.error('SUPABASE_DB_URL not set');
	process.exit(1);
}
const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
function assert(cond, msg) {
	if (!cond) throw new Error('ASSERTION FAILED: ' + msg);
}

try {
	await client.connect();
	await client.query('begin');

	// A multi-era theme (one player row per era → previously duplicated).
	const { rows: themeRows } = await client.query(
		`select id, display_name from public.themes where display_name = 'Barça històric' limit 1`
	);
	assert(themeRows.length === 1, "theme 'Barça històric' must exist");
	const themeId = themeRows[0].id;

	const mkUser = async (email) => {
		const { rows } = await client.query(
			`insert into auth.users (id, email, raw_user_meta_data)
			 values (gen_random_uuid(), $1::text, jsonb_build_object('display_name', $2::text))
			 returning id`,
			[email, email.split('@')[0]]
		);
		return rows[0].id;
	};
	const hostId = await mkUser('host@test.local');
	const p2Id = await mkUser('p2@test.local');

	// extra_per_position: 10 forces demand >> unique pool for thin positions (LW
	// has ~4 unique) → exercises the resilient fill path.
	const settings = {
		timer_seconds: 60,
		extra_per_position: 10,
		formation: { CM: 3, LW: 1, CB: 2 }
	};
	const { rows: roomRows } = await client.query(
		`insert into public.rooms (code, host_id, theme_id, status, settings)
		 values ('TST002', $1, $2, 'lobby', $3) returning id`,
		[hostId, themeId, JSON.stringify(settings)]
	);
	const roomId = roomRows[0].id;
	await client.query(
		`insert into public.room_members (room_id, user_id, budget_remaining_cents) values
		 ($1, $2, 100000000000), ($1, $3, 100000000000)`,
		[roomId, hostId, p2Id]
	);

	// Call start_room as host. With extras=10 this would raise on the old code;
	// the new resilient code must succeed.
	await client.query(`select set_config('request.jwt.claims', $1, true)`, [
		JSON.stringify({ sub: hostId, role: 'authenticated' })
	]);
	await client.query('select public.start_room($1)', [roomId]);

	const { rows: cnt } = await client.query(
		`select count(*)::int n from public.auctions where room_id = $1`,
		[roomId]
	);
	console.log(`auctions created: ${cnt[0].n}`);
	assert(cnt[0].n > 0, 'start_room created no auctions');

	// No real player appears twice in the same room.
	const { rows: dups } = await client.query(
		`select lower(p.name) nm, p.birth_year, count(*)::int c
		 from public.auctions a
		 join public.players p on p.id = a.player_id
		 where a.room_id = $1
		 group by lower(p.name), p.birth_year
		 having count(*) > 1
		 order by c desc`,
		[roomId]
	);
	if (dups.length) {
		console.log('duplicates found:', dups.map((d) => `${d.c}x ${d.nm} (${d.birth_year})`).join(', '));
	}
	assert(dups.length === 0, `duplicate players in room: ${dups.length} names repeated`);

	console.log('PASS: queue is duplicate-free and start_room is resilient to thin pools.');
	process.exitCode = 0;
} catch (err) {
	console.error(err.message);
	process.exitCode = 1;
} finally {
	await client.query('rollback').catch(() => {});
	await client.end();
}
