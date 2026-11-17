import type { SimPlayer, SimTeam, TeamRating } from './types';

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const EMPTY = 40;

/** 45 for auto players, else 52 + 14*log10(value in M euro), clamped to 40..96. */
export function playerRating(p: SimPlayer): number {
	if (p.rating != null) return p.rating;
	if (p.auto || p.marketValueCents == null) return 45;
	const millions = Math.max(1, p.marketValueCents / 1e8);
	return clamp(Math.round(52 + 14 * Math.log10(millions)), 40, 96);
}

/** Mean of the best `cap` ratings in a line (EMPTY if the line has no players). */
function line(t: SimTeam, positions: string[], cap: number): number {
	const rs = t.players
		.filter((p) => positions.includes(p.position))
		.map(playerRating)
		.sort((a, b) => b - a)
		.slice(0, cap);
	return rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : EMPTY;
}

export function teamRating(t: SimTeam): TeamRating {
	const gk = line(t, ['GK'], 1);
	const def = line(t, ['LB', 'RB', 'CB'], 5);
	const mid = line(t, ['CM'], 5);
	const att = line(t, ['LW', 'RW', 'ST'], 3);
	const overall = Math.round((0.1 * gk + 0.3 * def + 0.3 * mid + 0.3 * att) * 10) / 10;
	return { gk, def, mid, att, overall };
}
