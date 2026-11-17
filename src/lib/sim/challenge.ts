import { simulateMatch } from './match';
import { playerRating, teamRating } from './rating';
import type { MatchResult, SimPlayer, SimTeam } from './types';

// The 7-0 challenge: one match, your team away at a legendary side.

export type Medal = 'or' | 'plata' | 'bronze' | null;
export type ChallengeResult = {
	match: MatchResult;
	goalsFor: number;
	goalsAgainst: number;
	medal: Medal;
};

export const FORMATION_433: Record<string, number> = {
	GK: 1,
	CB: 2,
	LB: 1,
	RB: 1,
	CM: 3,
	ST: 1,
	LW: 1,
	RW: 1
};

// Who can cover a slot when the squad has nobody for it, in order of preference.
const COVER: Record<string, string[]> = {
	GK: ['GK'],
	CB: ['CB', 'LB', 'RB', 'CM'],
	LB: ['LB', 'CB', 'RB'],
	RB: ['RB', 'CB', 'LB'],
	CM: ['CM', 'LW', 'RW'],
	ST: ['ST', 'LW', 'RW', 'CM'],
	LW: ['LW', 'RW', 'ST', 'CM'],
	RW: ['RW', 'LW', 'ST', 'CM']
};

/** Best eleven for a formation, preferring natural positions, highest rated first. */
export function bestEleven(players: SimPlayer[], formation = FORMATION_433): SimPlayer[] {
	const pool = [...players].sort((a, b) => playerRating(b) - playerRating(a));
	const used = new Set<SimPlayer>();
	const xi: SimPlayer[] = [];
	for (const [slot, n] of Object.entries(formation)) {
		for (let i = 0; i < n; i++) {
			for (const pos of COVER[slot] ?? [slot]) {
				const p = pool.find((q) => !used.has(q) && q.position === pos);
				if (p) {
					used.add(p);
					xi.push({ ...p, position: slot });
					break;
				}
			}
		}
	}
	return xi;
}

export function medalFor(goalsFor: number, goalsAgainst: number): Medal {
	const margin = goalsFor - goalsAgainst;
	if (margin >= 7 && goalsAgainst === 0) return 'or';
	if (margin >= 3) return 'plata';
	if (margin >= 1) return 'bronze';
	return null;
}

/** One deterministic attempt per seed: the rival plays at home. */
export function simulateChallenge(team: SimTeam, rival: SimTeam, seed: string): ChallengeResult {
	const match = simulateMatch(rival, team, teamRating(rival), teamRating(team), 'challenge', seed);
	const goalsFor = match.awayGoals;
	const goalsAgainst = match.homeGoals;
	return { match, goalsFor, goalsAgainst, medal: medalFor(goalsFor, goalsAgainst) };
}
