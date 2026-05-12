import { describe, expect, it } from 'vitest';
import { formatCents, parseAmountToCents } from './currency';

// Reminder: 1€ = 100 cents, 1M€ = 100_000_000 cents = 1_000_000_00n.

describe('formatCents', () => {
	it.each([
		[1_000_000_00n, '1M€'],
		[5_000_000_00n, '5M€'],
		[50_000_000_00n, '50M€'],
		[100_000_000_00n, '100M€'],
		[1_000_000_000_00n, '1.000M€'],
		[2_500_000_00n, '2,5M€'],
		[12_500_000_00n, '13M€'], // ≥10M → no decimals (rounds half up)
		[500_000_00n, '500K€'], // 500K€ = 50M cents
		[100_00n, '100€']
	])('formats %d cents as %s', (input, expected) => {
		expect(formatCents(input)).toBe(expected);
	});

	it('accepts plain numbers too', () => {
		expect(formatCents(1_000_000_00)).toBe('1M€');
	});
});

describe('parseAmountToCents', () => {
	it.each([
		['5M', 5_000_000_00n],
		['1M', 1_000_000_00n],
		['5,5M', 5_500_000_00n],
		['10M', 10_000_000_00n],
		['1000M', 1_000_000_000_00n],
		['500K', 500_000_00n],
		['100', 10_000_000_000n], // bare numbers are millions: 100 = 100M€
		['  5m  ', 5_000_000_00n],
		['5M€', 5_000_000_00n]
	])('parses "%s" → %d cents', (input, expected) => {
		expect(parseAmountToCents(input)).toBe(expected);
	});

	it.each([
		['50', 5_000_000_000n],
		['1', 100_000_000n],
		['1000', 100_000_000_000n],
		['0,5', 50_000_000n],
		['0.5', 50_000_000n],
		['5,5', 550_000_000n],
		['50€', 5_000_000_000n],
		['5M€', 500_000_000n]
	])('parses bare-number "%s" as millions → %d cents', (input, expected) => {
		expect(parseAmountToCents(input)).toBe(expected);
	});

	it.each(['', 'abc', '5X', '--5M'])('rejects invalid input "%s"', (input) => {
		expect(parseAmountToCents(input)).toBeNull();
	});
});
