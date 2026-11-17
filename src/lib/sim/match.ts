import { playerRating } from './rating';
import { poisson, rngFor, type Rand } from './rng';
import type { Goal, MatchResult, SimTeam, TeamRating } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const BASE_GOALS = 1.35;
const HOME_EDGE = 1.08;

const POSITION_WEIGHT: Record<string, number> = {
	ST: 5,
	LW: 3,
	RW: 3,
	CM: 1.5,
	LB: 0.4,
	RB: 0.4,
	CB: 0.4,
	GK: 0.02
};

/** Expected goals for the attacking side. */
export function lambdaFor(att: TeamRating, def: TeamRating, home: boolean): number {
	const diff = att.att * 0.6 + att.mid * 0.4 - (def.def * 0.5 + def.mid * 0.3 + def.gk * 0.2);
	return clamp(BASE_GOALS * Math.exp(diff / 20) * (home ? HOME_EDGE : 1), 0.15, 4);
}

function pickScorer(team: SimTeam, rand: Rand): string {
	const real = team.players.filter((p) => !p.auto);
	const pool = real.length ? real : team.players;
	if (!pool.length) return team.name;
	const weights = pool.map(
		(p) => (POSITION_WEIGHT[p.position] ?? 0.4) * (playerRating(p) / 70) ** 2
	);
	let r = rand() * weights.reduce((a, b) => a + b, 0);
	for (let i = 0; i < pool.length; i++) {
		r -= weights[i];
		if (r < 0) return pool[i].name;
	}
	return pool[pool.length - 1].name;
}

function makeGoals(
	team: SimTeam,
	n: number,
	minMinute: number,
	maxMinute: number,
	rand: Rand
): Goal[] {
	return Array.from({ length: n }, () => ({
		teamId: team.id,
		scorer: pickScorer(team, rand),
		minute: minMinute + Math.floor(rand() * (maxMinute - minMinute + 1))
	}));
}

function shootout(pHome: number, pAway: number, rand: Rand) {
	let home = 0;
	let away = 0;
	for (let i = 0; i < 5; i++) {
		if (rand() < pHome) home++;
		if (rand() < pAway) away++;
	}
	while (home === away) {
		if (rand() < pHome) home++;
		if (rand() < pAway) away++;
	}
	return { home, away };
}

export function simulateMatch(
	home: SimTeam,
	away: SimTeam,
	rh: TeamRating,
	ra: TeamRating,
	stage: 'league' | 'final',
	seed: string
): MatchResult {
	const rand = rngFor(`${seed}|${stage}|${home.id}|${away.id}`);
	const lh = lambdaFor(rh, ra, true);
	const la = lambdaFor(ra, rh, false);
	let goals = [
		...makeGoals(home, poisson(lh, rand), 1, 90, rand),
		...makeGoals(away, poisson(la, rand), 1, 90, rand)
	];
	let extraTime = false;
	let penalties: MatchResult['penalties'] = null;
	const count = (id: string) => goals.filter((g) => g.teamId === id).length;

	if (stage === 'final' && count(home.id) === count(away.id)) {
		extraTime = true;
		goals = [
			...goals,
			...makeGoals(home, poisson((lh * 30) / 90, rand), 91, 120, rand),
			...makeGoals(away, poisson((la * 30) / 90, rand), 91, 120, rand)
		];
		if (count(home.id) === count(away.id)) {
			const d = clamp(0.01 * (rh.gk - ra.gk), -0.08, 0.08);
			penalties = shootout(0.75 + d, 0.75 - d, rand);
		}
	}
	goals.sort((a, b) => a.minute - b.minute);
	const homeGoals = count(home.id);
	const awayGoals = count(away.id);
	let winnerId: string | null = null;
	if (penalties) winnerId = penalties.home > penalties.away ? home.id : away.id;
	else if (homeGoals !== awayGoals) winnerId = homeGoals > awayGoals ? home.id : away.id;
	return {
		stage,
		homeId: home.id,
		awayId: away.id,
		homeGoals,
		awayGoals,
		goals,
		extraTime,
		penalties,
		winnerId
	};
}
