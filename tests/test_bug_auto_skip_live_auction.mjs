// Reproduces bug: an auto-advance skips a LIVE (non-expired, no-bid) auction,
// surfacing as "SENSE PUJADES" on ~half the players.
//
// Root cause: advance_auction let the host advance an active auction whose
// timer had NOT expired. The client fires advanceAuction whenever its local
// secondsLeft hits 0; across client races a freshly-activated auction (ends_at
// in the future, no bids) got skipped before anyone could bid.
//
// Fix: advance_auction(p_room_id, p_force default false). A non-forced advance
// no-ops on a still-live auction; the host's explicit "force" skip passes true.
//
// This test asserts BOTH directions:
//   1. non-forced advance on a live auction -> auction stays 'active'
//   2. forced advance on a live auction      -> auction becomes 'skipped'
//
// Runs each scenario in its own transaction that is ROLLED BACK, so the real DB
// is untouched. Usage: node tests/test_bug_auto_skip_live_auction.mjs

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

// Build a minimal drafting room with one active (non-expired, no-bid) auction #1
// and one pending auction #2. Returns { hostId, roomId, auctionId }.
async function setup() {
	const { rows: themeRows } = await client.query('select id from public.themes limit 1');
	assert(themeRows.length === 1, 'need at least one seeded theme');
	const themeId = themeRows[0].id;

	const { rows: playerRows } = await client.query(
		`select id, primary_position from public.players where is_scrub = false limit 1`
	);
	assert(playerRows.length === 1, 'need at least one non-scrub player');
	const playerId = playerRows[0].id;
	const pos = playerRows[0].primary_position;

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

	const settings = { timer_seconds: 60, formation: { [pos]: 1 }, extra_per_position: 0 };
	const { rows: roomRows } = await client.query(
		`insert into public.rooms (code, host_id, theme_id, status, settings, started_at)
		 values ('TST001', $1, $2, 'drafting', $3, now()) returning id`,
		[hostId, themeId, JSON.stringify(settings)]
	);
	const roomId = roomRows[0].id;

	await client.query(
		`insert into public.room_members (room_id, user_id, budget_remaining_cents) values
		 ($1, $2, 100000000000), ($1, $3, 100000000000)`,
		[roomId, hostId, p2Id]
	);

	// Auction #1: ACTIVE, ends in 60s (NOT expired), no bids.
	const { rows: aRows } = await client.query(
		`insert into public.auctions
		   (room_id, player_id, position_slot, sequence_number, status, started_at, ends_at)
		 values ($1, $2, $3::position_code, 1, 'active', now(), now() + interval '60 seconds')
		 returning id`,
		[roomId, playerId, pos]
	);
	const auctionId = aRows[0].id;

	// Auction #2: pending (so advance moves here instead of triggering voting).
	await client.query(
		`insert into public.auctions
		   (room_id, player_id, position_slot, sequence_number, status)
		 values ($1, $2, $3::position_code, 2, 'pending')`,
		[roomId, playerId, pos]
	);

	return { hostId, roomId, auctionId };
}

async function statusOf(auctionId) {
	const { rows } = await client.query('select status from public.auctions where id = $1', [
		auctionId
	]);
	return rows[0].status;
}

try {
	await client.connect();

	// --- Scenario 1: non-forced advance must NOT skip a live auction ---
	await client.query('begin');
	{
		const { hostId, roomId, auctionId } = await setup();
		await client.query(`select set_config('request.jwt.claims', $1, true)`, [
			JSON.stringify({ sub: hostId, role: 'authenticated' })
		]);
		await client.query('select public.advance_auction($1)', [roomId]); // p_force defaults false
		const status = await statusOf(auctionId);
		console.log(`[non-forced] auction #1 status: ${status}`);
		assert(
			status === 'active',
			`live non-expired auction was skipped (status=${status}) -> "SENSE PUJADES" bug`
		);
	}
	await client.query('rollback');

	// --- Scenario 2: forced advance (host "Següent (forçar)") still skips it ---
	await client.query('begin');
	{
		const { hostId, roomId, auctionId } = await setup();
		await client.query(`select set_config('request.jwt.claims', $1, true)`, [
			JSON.stringify({ sub: hostId, role: 'authenticated' })
		]);
		await client.query('select public.advance_auction($1, true)', [roomId]); // p_force = true
		const status = await statusOf(auctionId);
		console.log(`[forced]     auction #1 status: ${status}`);
		assert(
			status === 'skipped',
			`forced advance failed to skip live auction (status=${status})`
		);
	}
	await client.query('rollback');

	console.log('PASS: non-forced preserves live auction; forced still skips.');
	process.exitCode = 0;
} catch (err) {
	console.error(err.message);
	await client.query('rollback').catch(() => {});
	process.exitCode = 1;
} finally {
	await client.end();
}
