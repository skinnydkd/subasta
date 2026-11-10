import type { ActionData, PageData } from '../../../routes/room/[code]/$types';

export type RoomData = PageData;
export type RoomForm = ActionData;
export type Member = PageData['members'][number];
export type TeamPlayer = PageData['teamsByUser'][string][number];

// Formation rendering order: top → bottom of pitch.
export const FORMATION_ROWS: { label: string; positions: string[] }[] = [
	{ label: 'Davanters', positions: ['LW', 'ST', 'RW'] },
	{ label: 'Migcampistes', positions: ['CM'] },
	{ label: 'Defenses', positions: ['LB', 'CB', 'RB'] },
	{ label: 'Porter', positions: ['GK'] }
];

export function teamByPosition(team: TeamPlayer[]): Record<string, TeamPlayer[]> {
	const out: Record<string, TeamPlayer[]> = {};
	for (const p of team) (out[p.position_slot] ||= []).push(p);
	return out;
}

export function teamSpentCents(teamsByUser: PageData['teamsByUser'], userId: string): number {
	return (teamsByUser[userId] ?? []).reduce((sum, p) => sum + (p.final_price_cents ?? 0), 0);
}
