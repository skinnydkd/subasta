import { simulateMatch } from './match';
import { teamRating } from './rating';
import type { MatchResult, SimTeam, Standing, TournamentResult } from './types';

/** Circle-method pairings per round, [home, away] indices; bye (index n) is skipped. */
function schedule(n: number): [number, number][][] {
	const ids = Array.from({ length: n % 2 ? n + 1 : n }, (_, i) => i);
	const m = ids.length;
	const rounds: [number, number][][] = [];
	for (let r = 0; r < m - 1; r++) {
		const round: [number, number][] = [];
		for (let i = 0; i < m / 2; i++) {
			const a = ids[i];
			const b = ids[m - 1 - i];
			if (a >= n || b >= n) continue;
			// Alternate home/away so teams do not always host
			round.push((r + i) % 2 === 0 ? [a, b] : [b, a]);
		}
		rounds.push(round);
		ids.splice(1, 0, ids.pop()!);
	}
	return rounds;
}

export function simulateTournament(teams: SimTeam[], seed: string): TournamentResult {
	const ratings = Object.fromEntries(teams.map((t) => [t.id, teamRating(t)]));
	const play = (h: SimTeam, a: SimTeam, stage: 'league' | 'final') =>
		simulateMatch(h, a, ratings[h.id], ratings[a.id], stage, seed);

	const matches: MatchResult[] = [];
	const standings = new Map<string, Standing>(
		teams.map((t) => [
			t.id,
			{
				teamId: t.id,
				played: 0,
				won: 0,
				drawn: 0,
				lost: 0,
				goalsFor: 0,
				goalsAgainst: 0,
				points: 0
			}
		])
	);

	if (teams.length > 2) {
		const rounds = schedule(teams.length);
		const legs = [...rounds, ...rounds.map((r) => r.map(([h, a]) => [a, h] as [number, number]))];
		for (const round of legs)
			for (const [h, a] of round) matches.push(play(teams[h], teams[a], 'league'));
		for (const m of matches) {
			const h = standings.get(m.homeId)!;
			const a = standings.get(m.awayId)!;
			h.played++;
			a.played++;
			h.goalsFor += m.homeGoals;
			h.goalsAgainst += m.awayGoals;
			a.goalsFor += m.awayGoals;
			a.goalsAgainst += m.homeGoals;
			if (m.winnerId === null) {
				h.drawn++;
				a.drawn++;
				h.points++;
				a.points++;
			} else {
				const [w, l] = m.winnerId === m.homeId ? [h, a] : [a, h];
				w.won++;
				w.points += 3;
				l.lost++;
			}
		}
	}

	const table = [...standings.values()].sort(
		(x, y) =>
			y.points - x.points ||
			y.goalsFor - y.goalsAgainst - (x.goalsFor - x.goalsAgainst) ||
			y.goalsFor - x.goalsFor ||
			ratings[y.teamId].overall - ratings[x.teamId].overall ||
			(x.teamId < y.teamId ? -1 : 1)
	);

	let final: MatchResult | null = null;
	if (teams.length >= 2) {
		const byId = new Map(teams.map((t) => [t.id, t]));
		const [first, second] =
			teams.length === 2 ? teams : [table[0], table[1]].map((s) => byId.get(s.teamId)!);
		final = play(first, second, 'final');
	}

	// Top scorer: first to reach the highest count wins ties.
	const counts = new Map<string, { teamId: string; name: string; goals: number }>();
	let topScorer: TournamentResult['topScorer'] = null;
	for (const m of final ? [...matches, final] : matches) {
		for (const g of m.goals) {
			const key = `${g.teamId}\u0000${g.scorer}`;
			const c = counts.get(key) ?? { teamId: g.teamId, name: g.scorer, goals: 0 };
			c.goals++;
			counts.set(key, c);
			if (!topScorer || c.goals > topScorer.goals) topScorer = { ...c };
		}
	}

	return { ratings, matches, table, final, championId: final?.winnerId ?? null, topScorer };
}
