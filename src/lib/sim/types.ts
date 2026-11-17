/** position: GK LB RB CB CM LW RW ST; auto=true for auto-assigned filler players */
export type SimPlayer = {
	name: string;
	position: string;
	marketValueCents: number | null;
	auto: boolean;
};
export type SimTeam = { id: string; name: string; players: SimPlayer[] };
export type TeamRating = { gk: number; def: number; mid: number; att: number; overall: number };
export type Goal = { teamId: string; scorer: string; minute: number };
export type MatchResult = {
	stage: 'league' | 'final';
	homeId: string;
	awayId: string;
	/** After extra time if any. */
	homeGoals: number;
	awayGoals: number;
	/** Sorted by minute. */
	goals: Goal[];
	extraTime: boolean;
	penalties: { home: number; away: number } | null;
	/** null = draw (league only) */
	winnerId: string | null;
};
export type Standing = {
	teamId: string;
	played: number;
	won: number;
	drawn: number;
	lost: number;
	goalsFor: number;
	goalsAgainst: number;
	points: number;
};
export type TournamentResult = {
	ratings: Record<string, TeamRating>;
	matches: MatchResult[];
	table: Standing[];
	final: MatchResult | null;
	championId: string | null;
	topScorer: { teamId: string; name: string; goals: number } | null;
};
