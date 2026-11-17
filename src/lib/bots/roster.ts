// The machine's players. Each is a real auth user (seeded with a fixed id in
// supabase/seed/23_bots.sql) so it joins rooms and bids through the same SQL
// functions as people do. Names are fictional on purpose.

export type BotStyle = 'tacany' | 'estrella' | 'tactic' | 'impulsiu' | 'franctirador';
export type BotDifficulty = 'facil' | 'normal' | 'dificil';
export type Bot = { id: string; name: string; style: BotStyle; blurb: string };

export const BOTS: Bot[] = [
	{
		id: 'b0700000-0000-4000-8000-000000000001',
		name: 'El Tàctic',
		style: 'tactic',
		blurb: 'Omple la plantilla amb cap i paga més quan una posició escasseja.'
	},
	{
		id: 'b0700000-0000-4000-8000-000000000002',
		name: "L'Estrella",
		style: 'estrella',
		blurb: 'Es deixa la caixa en les figures i passa dels gregaris.'
	},
	{
		id: 'b0700000-0000-4000-8000-000000000003',
		name: 'El Tacany',
		style: 'tacany',
		blurb: 'Només compra gangues. Si et descuides, et guanya amb l’ofici.'
	},
	{
		id: 'b0700000-0000-4000-8000-000000000004',
		name: "L'Impulsiu",
		style: 'impulsiu',
		blurb: 'Puja a bots per espantar i de vegades s’hi passa.'
	},
	{
		id: 'b0700000-0000-4000-8000-000000000005',
		name: 'El Franctirador',
		style: 'franctirador',
		blurb: 'Calla tota l’estona i entra en els últims segons.'
	}
];

const byId = new Map(BOTS.map((b) => [b.id, b]));

export const botById = (id: string): Bot | undefined => byId.get(id);
export const isBot = (id: string | null | undefined): boolean => !!id && byId.has(id);

export const DIFFICULTIES: { value: BotDifficulty; label: string }[] = [
	{ value: 'facil', label: 'Fàcil' },
	{ value: 'normal', label: 'Normal' },
	{ value: 'dificil', label: 'Difícil' }
];
