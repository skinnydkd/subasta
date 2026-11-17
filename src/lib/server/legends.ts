import {
	bestEleven,
	playerRating,
	simulateChallenge,
	teamRating,
	type ChallengeResult,
	type SimTeam
} from '$lib/sim';
import { hashString } from '$lib/sim/rng';
import { query } from './db';

// Legendary rivals for the 7-0 challenge, by tier. Squads come from the seeded
// tags; "floor" lifts every rival player to at least that rating because the
// seeded market values are not comparable across eras.

type Tier = 'campio' | 'gran' | 'llegenda';
const TIERS: { tier: Tier; label: string; floor: number; squads: [string, string][] }[] = [
	{
		tier: 'campio',
		label: 'Equip campió',
		floor: 74,
		squads: [
			['liverpool-2004-05', 'Liverpool 2004-05'],
			['chelsea-2011-12', 'Chelsea 2011-12'],
			['inter-2009-10', 'Inter 2009-10'],
			['por-euro-2016', 'Portugal 2016'],
			['ita-wc-2006', 'Itàlia 2006'],
			['villarreal-2005-06', 'Villarreal 2005-06']
		]
	},
	{
		tier: 'gran',
		label: 'Gran equip',
		floor: 80,
		squads: [
			['milan-2006-07', 'Milan 2006-07'],
			['manutd-2007-08', 'Manchester United 2007-08'],
			['madrid-2016-17', 'Real Madrid 2016-17'],
			['bayern-2012-13', 'Bayern 2012-13'],
			['ger-wc-2014', 'Alemanya 2014'],
			['fra-wc-2018', 'França 2018']
		]
	},
	{
		tier: 'llegenda',
		label: 'Llegenda',
		floor: 86,
		squads: [
			['barca-2010-11', 'Barça 2010-11'],
			['barca-2008-09', 'Barça 2008-09'],
			['esp-wc-2010', 'Espanya 2010'],
			['bra-wc-2002', 'Brasil 2002'],
			['madrid-2002-03', 'Real Madrid 2002-03'],
			['manutd-1998-99', 'Manchester United 1998-99']
		]
	}
];

export type Rival = {
	key: string;
	name: string;
	tier: Tier;
	tierLabel: string;
	rating: number;
	team: SimTeam;
};

export type Challenge = {
	rivals: Rival[];
	/** userId -> rival key -> result */
	results: Record<string, Record<string, ChallengeResult>>;
};

/** One rival per tier, picked from the room id so everyone in the room faces the same three. */
export async function loadRivals(roomId: string): Promise<Rival[]> {
	const picks = TIERS.map((t) => {
		const [slug, name] = t.squads[hashString(`${roomId}|${t.tier}`) % t.squads.length];
		return { ...t, slug, name };
	});
	const rows = await query<{ slug: string; name: string; pos: string; mv: string | null }>(
		null,
		`select g.slug, p.name, p.primary_position::text as pos, p.market_value_cents::text as mv
		 from public.tags g
		 join public.player_tags pt on pt.tag_id = g.id
		 join public.players p on p.id = pt.player_id
		 where g.slug = any($1::text[]) and not p.is_scrub`,
		[picks.map((p) => p.slug)]
	);
	return picks.map((p) => {
		const squad = rows
			.filter((r) => r.slug === p.slug)
			.map((r) => {
				const base = playerRating({
					name: r.name,
					position: r.pos,
					marketValueCents: r.mv === null ? null : Number(r.mv),
					auto: false
				});
				// Keep a little of the spread between the stars and the rest.
				const rating = Math.max(base, p.floor + Math.round((base - 52) / 8));
				return { name: r.name, position: r.pos, marketValueCents: null, auto: false, rating };
			});
		const team: SimTeam = { id: `legend:${p.slug}`, name: p.name, players: bestEleven(squad) };
		return {
			key: p.slug,
			name: p.name,
			tier: p.tier,
			tierLabel: p.label,
			rating: teamRating(team).overall,
			team
		};
	});
}

export async function playChallenge(roomId: string, teams: SimTeam[]): Promise<Challenge> {
	const rivals = await loadRivals(roomId);
	const results: Challenge['results'] = {};
	for (const t of teams) {
		results[t.id] = Object.fromEntries(
			rivals.map((r) => [r.key, simulateChallenge(t, r.team, `${roomId}|${t.id}|${r.key}`)])
		);
	}
	return { rivals, results };
}
