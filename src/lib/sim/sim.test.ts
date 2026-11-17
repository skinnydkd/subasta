import { describe, expect, it } from 'vitest';
import {
	playerRating,
	simulateTournament,
	teamRating,
	type SimPlayer,
	type SimTeam
} from './index';

const POS = ['GK', 'LB', 'RB', 'CB', 'CB', 'CM', 'CM', 'CM', 'LW', 'RW', 'ST'];

function team(id: string, millions: number | null): SimTeam {
	return {
		id,
		name: id,
		players: POS.map((position, i) => ({
			name: `${id}-${i}`,
			position,
			marketValueCents: millions === null ? null : millions * 1e8,
			auto: millions === null
		}))
	};
}

const p = (position: string, m: number | null, auto = false): SimPlayer => ({
	name: 'x',
	position,
	marketValueCents: m === null ? null : m * 1e8,
	auto
});

describe('ratings', () => {
	it('maps values', () => {
		expect(playerRating(p('ST', 500, true))).toBe(45);
		expect(playerRating(p('ST', 1))).toBe(52);
		expect(playerRating(p('ST', 100))).toBe(80);
		expect(playerRating(p('ST', 0.01))).toBe(52);
		expect(playerRating(p('ST', 1e9))).toBe(96);
		expect(playerRating(p('ST', null))).toBe(45);
	});
	it('empty lines are 40', () => {
		const r = teamRating({ id: 'a', name: 'a', players: [p('GK', 100)] });
		expect(r).toMatchObject({ gk: 80, def: 40, mid: 40, att: 40 });
	});
});

describe('tournament', () => {
	const four = [team('a', 100), team('b', 50), team('c', 20), team('d', null)];

	it('is deterministic', () => {
		expect(simulateTournament(four, 's1')).toEqual(simulateTournament(four, 's1'));
		expect(simulateTournament(four, 's1')).not.toEqual(simulateTournament(four, 's2'));
	});

	it('strong beats auto in the final', () => {
		const duo = [team('s', 100), team('w', null)];
		let wins = 0;
		for (let i = 0; i < 1000; i++)
			if (simulateTournament(duo, `seed${i}`).championId === 's') wins++;
		expect(wins / 1000).toBeGreaterThan(0.85);
	});

	it('has a consistent structure', () => {
		const r = simulateTournament(four, 'x');
		expect(r.matches).toHaveLength(12);
		expect(r.table).toHaveLength(4);
		for (const s of r.table) expect(s.played).toBe(6);
		const draws = r.matches.filter((m) => m.winnerId === null).length;
		expect(r.table.reduce((a, s) => a + s.points, 0)).toBe(3 * (12 - draws) + 2 * draws);
		expect(r.final?.winnerId).toBeTruthy();
		expect(r.championId).toBe(r.final?.winnerId);
		expect(r.final?.homeId).toBe(r.table[0].teamId);
		expect(r.final?.awayId).toBe(r.table[1].teamId);

		const duo = simulateTournament(four.slice(0, 2), 'x');
		expect(duo.matches).toHaveLength(0);
		expect(duo.final).not.toBeNull();
	});

	it('schedules every pair home and away for 3..8 teams', () => {
		for (let n = 3; n <= 8; n++) {
			const ts = Array.from({ length: n }, (_, i) => team(`t${i}`, 10));
			const r = simulateTournament(ts, 'x');
			expect(r.matches).toHaveLength(n * (n - 1));
			expect(new Set(r.matches.map((m) => `${m.homeId}>${m.awayId}`)).size).toBe(n * (n - 1));
		}
	});

	it('goals are consistent', () => {
		for (let i = 0; i < 50; i++) {
			const r = simulateTournament(four, `g${i}`);
			for (const m of [...r.matches, r.final!]) {
				expect(m.goals).toHaveLength(m.homeGoals + m.awayGoals);
				for (const g of m.goals) expect([m.homeId, m.awayId]).toContain(g.teamId);
				const t = four.find((x) => x.id === m.homeId)!;
				for (const g of m.goals.filter((g) => g.teamId === m.homeId))
					expect(t.players.some((pl) => pl.name === g.scorer)).toBe(true);
				expect(m.penalties !== null).toBe(m.extraTime && m.homeGoals === m.awayGoals);
				if (m.stage === 'league') expect(m.extraTime).toBe(false);
			}
		}
	});

	it('topScorer is the max', () => {
		const r = simulateTournament(four, 'ts');
		const c = new Map<string, number>();
		for (const m of [...r.matches, r.final!])
			for (const g of m.goals)
				c.set(`${g.teamId}|${g.scorer}`, (c.get(`${g.teamId}|${g.scorer}`) ?? 0) + 1);
		expect(r.topScorer?.goals).toBe(Math.max(...c.values()));
	});
});
