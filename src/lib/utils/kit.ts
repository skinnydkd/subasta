// Representative "kit" colours per club / national team. We deliberately avoid
// real player photos (image and personality rights) and club crests (trademarks):
// the avatar is a plain shirt in the team's colours with the player's initials.

export type Pattern = 'plain' | 'stripes' | 'hoops';
export type Kit = { primary: string; secondary: string; ink: string; pattern: Pattern };

const k = (primary: string, secondary: string, pattern: Pattern = 'plain'): Omit<Kit, 'ink'> => ({
	primary,
	secondary,
	pattern
});

// First match wins, so more specific names go first. Names are matched
// case-insensitively and accent-insensitively against `metadata.team`.
const KITS: [RegExp, Omit<Kit, 'ink'>][] = [
	[/real madrid/, k('#f4f1ea', '#c8a24a')],
	[/barcelona|barca/, k('#a50044', '#004d98', 'stripes')],
	[/atletico/, k('#cb3524', '#f4f1ea', 'stripes')],
	[/athletic/, k('#d4141c', '#f4f1ea', 'stripes')],
	[/real sociedad/, k('#1d63b0', '#f4f1ea', 'stripes')],
	[/villarreal/, k('#f3d317', '#00519a')],
	[/manchester city/, k('#6cabdd', '#f4f1ea')],
	[/manchester united/, k('#da291c', '#1a1a1a')],
	[/arsenal/, k('#ef0107', '#f4f1ea')],
	[/liverpool/, k('#c8102e', '#f4f1ea')],
	[/chelsea/, k('#034694', '#f4f1ea')],
	[/tottenham/, k('#f4f1ea', '#132257')],
	[/newcastle/, k('#1a1a1a', '#f4f1ea', 'stripes')],
	[/aston villa/, k('#7a1f3d', '#95bfe5')],
	[/psg|paris/, k('#0b2a5b', '#da291c')],
	[/bayern/, k('#dc052d', '#0b4ea2')],
	[/dortmund/, k('#fde100', '#1a1a1a')],
	[/leverkusen/, k('#e32221', '#1a1a1a')],
	[/inter/, k('#0b5fa8', '#111111', 'stripes')],
	[/milan/, k('#c8102e', '#111111', 'stripes')],
	[/juventus/, k('#f4f1ea', '#111111', 'stripes')],
	[/napoli/, k('#12a0d7', '#f4f1ea')],
	[/roma/, k('#8e1f2f', '#f0bc42')],
	[/atalanta/, k('#1e71b8', '#111111', 'stripes')],
	[/benfica/, k('#e83030', '#f4f1ea')],
	[/porto/, k('#0a3a8f', '#f4f1ea', 'stripes')],
	[/sporting/, k('#0a8a5f', '#f4f1ea', 'hoops')],
	// National teams (English, Spanish and Catalan spellings).
	[/spain|espanya|espana/, k('#c60b1e', '#ffc400')],
	[/argentina/, k('#75aadb', '#f4f1ea', 'stripes')],
	[/france|franca|francia/, k('#1f3a93', '#f4f1ea')],
	[/brazil|brasil/, k('#fedd00', '#009c3b')],
	[/portugal/, k('#a0152c', '#0a7a3a')],
	[/england|anglaterra|inglaterra/, k('#f4f1ea', '#1c2c5b')],
	[/germany|alemanya|alemania/, k('#f4f1ea', '#111111')],
	[/netherlands|holanda|paisos baixos|paises bajos/, k('#f36c21', '#111111')],
	[/italy|italia/, k('#0e4a9e', '#f4f1ea')]
];

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pick readable text colour (black or white) for a background hex. */
function inkFor(hex: string): string {
	const n = parseInt(hex.slice(1), 16);
	const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
	return lum > 0.6 ? '#141210' : '#faf7f2';
}

function hash(s: string): number {
	let h = 0;
	for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
	return h;
}

/** Kit for a team name; unknown teams get a stable colour derived from the name. */
export function kitFor(team: string | null | undefined, fallbackSeed = ''): Kit {
	const key = strip(team ?? '');
	const hit = KITS.find(([re]) => re.test(key));
	if (hit) return { ...hit[1], ink: inkFor(hit[1].primary) };
	const hue = hash(key || strip(fallbackSeed)) % 360;
	const primary = `hsl(${hue} 45% 38%)`;
	return { primary, secondary: `hsl(${hue} 40% 72%)`, ink: '#faf7f2', pattern: 'plain' };
}

/** "Pedro Rodríguez" → "PR"; single names give one letter; "Vinícius Jr." keeps the first two words. */
export function initials(fullName: string): string {
	const parts = fullName.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return '?';
	if (parts.length === 1) return parts[0][0].toUpperCase();
	return (parts[0][0] + parts[1][0]).toUpperCase();
}
