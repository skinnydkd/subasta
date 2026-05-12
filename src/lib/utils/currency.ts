/**
 * All monetary amounts are bigint cents of EUR.
 * Formatting is presentation-only; never feed parsed strings back into bid logic.
 */

const M = 1_000_000_00n; // 1M€ = 100,000,000 cents

function formatThousands(n: number): string {
	// Spanish convention: period as thousands separator. Do it by hand because
	// Node's ICU support for toLocaleString grouping varies.
	const s = String(Math.abs(n));
	let out = '';
	for (let i = 0; i < s.length; i++) {
		if (i > 0 && (s.length - i) % 3 === 0) out += '.';
		out += s[i];
	}
	return n < 0 ? '-' + out : out;
}

/**
 * Format cents into football-transfer style: "1.000M€", "12,5M€", "950K€".
 * Uses Spanish locale (period thousands, comma decimal).
 */
export function formatCents(cents: bigint | number): string {
	const c = typeof cents === 'bigint' ? cents : BigInt(Math.trunc(cents));

	if (c >= M) {
		const millionsTimes10 = Number((c * 10n) / M); // 1 decimal of precision
		const whole = Math.trunc(millionsTimes10 / 10);
		const decimal = millionsTimes10 % 10;
		const wholeStr = formatThousands(whole);
		if (whole < 10 && decimal !== 0) {
			return `${wholeStr},${decimal}M€`;
		}
		// ≥10M (or whole.X with X=0): no decimals shown; round half-up if needed
		const rounded = Math.round(millionsTimes10 / 10);
		return `${formatThousands(rounded)}M€`;
	}

	// Sub-million: format whole euros (rare in this game; min bid is 1M€).
	const eur = Number(c) / 100;
	if (eur >= 1000) {
		return formatThousands(Math.round(eur / 1000)) + 'K€';
	}
	return formatThousands(Math.round(eur)) + '€';
}

/** Parse a user input like "5", "5M", "5,5M" into cents. Returns null on invalid. */
export function parseAmountToCents(input: string): bigint | null {
	const trimmed = input.trim().toUpperCase().replace(/\s+/g, '').replace('€', '');
	if (!trimmed) return null;

	// Bare numbers (no M/K suffix) default to millions — the game runs at million-scale.
	let multiplier = M;
	let core = trimmed;
	if (core.endsWith('M')) {
		multiplier = M;
		core = core.slice(0, -1);
	} else if (core.endsWith('K')) {
		multiplier = 1000_00n;
		core = core.slice(0, -1);
	}

	const normalized = core.replace(',', '.');
	if (!/^\d+(\.\d+)?$/.test(normalized)) return null;

	const [whole, frac = ''] = normalized.split('.');
	const fracDigits = frac.length;
	const fracBig = BigInt(frac || '0');
	const wholeBig = BigInt(whole);

	if (!fracDigits) return wholeBig * multiplier;
	const denom = 10n ** BigInt(fracDigits);
	return wholeBig * multiplier + (fracBig * multiplier) / denom;
}
