import { describe, expect, it } from 'vitest';
import { bestEleven, medalFor, simulateChallenge, FORMATION_433 } from './challenge';
import type { SimPlayer, SimTeam } from './types';

const POS = ['GK', 'CB', 'CB', 'LB', 'RB', 'CM', 'CM', 'CM', 'ST', 'LW', 'RW'];
const team = (id: string, rating: number): SimTeam => ({
	id,
	name: id,
	players: POS.map((position, i) => ({
		name: `${id}${i}`,
		position,
		marketValueCents: null,
		auto: false,
		rating
	}))
});

const goldRate = (mine: number, rival: number, n = 1000) => {
	let gold = 0;
	for (let i = 0; i < n; i++) {
		if (simulateChallenge(team('me', mine), team('legend', rival), `s${i}`).medal === 'or') gold++;
	}
	return gold / n;
};

describe('medalFor', () => {
	it('grades the margin', () => {
		expect(medalFor(7, 0)).toBe('or');
		expect(medalFor(8, 1)).toBe('plata');
		expect(medalFor(3, 0)).toBe('plata');
		expect(medalFor(1, 0)).toBe('bronze');
		expect(medalFor(2, 2)).toBeNull();
		expect(medalFor(0, 3)).toBeNull();
	});
});

describe('bestEleven', () => {
	it('fills a 4-3-3 with natural positions first', () => {
		const xi = bestEleven(team('a', 80).players);
		expect(xi).toHaveLength(11);
		for (const [slot, n] of Object.entries(FORMATION_433)) {
			expect(xi.filter((p) => p.position === slot)).toHaveLength(n);
		}
	});

	it('covers a missing position from the nearest line and keeps the best', () => {
		const players: SimPlayer[] = [
			...team('a', 70).players.filter((p) => p.position !== 'LB'),
			{ name: 'star', position: 'CB', marketValueCents: null, auto: false, rating: 90 }
		];
		const xi = bestEleven(players);
		expect(xi).toHaveLength(11);
		expect(xi.find((p) => p.name === 'star')?.position).toBe('CB');
	});
});

describe('simulateChallenge', () => {
	it('is deterministic per seed and medal matches the score', () => {
		const a = simulateChallenge(team('me', 80), team('legend', 86), 'room|me|barca');
		const b = simulateChallenge(team('me', 80), team('legend', 86), 'room|me|barca');
		expect(a).toEqual(b);
		expect(a.medal).toBe(medalFor(a.goalsFor, a.goalsAgainst));
		expect(a.goalsFor + a.goalsAgainst).toBe(a.match.goals.length);
		expect(a.match.extraTime).toBe(false);
	});

	it('a 7-0 is possible for a great side against a modest champion', () => {
		const rate = goldRate(96, 74);
		expect(rate).toBeGreaterThan(0.1);
		expect(rate).toBeLessThan(0.6);
	});

	it('an ordinary side almost never thrashes a legend', () => {
		expect(goldRate(78, 86)).toBeLessThan(0.01);
	});
});
