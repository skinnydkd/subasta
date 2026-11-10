import { describe, expect, it } from 'vitest';
import { initials, kitFor } from './kit';

describe('kitFor', () => {
	it('matches clubs ignoring season suffix, case and accents', () => {
		expect(kitFor('Real Madrid 2013-14').primary).toBe(kitFor('REAL MADRID').primary);
		expect(kitFor('Atlético').pattern).toBe('stripes');
		expect(kitFor('FC Barcelona 2008-09').secondary).toBe('#004d98');
	});

	it('does not confuse Real Madrid with other clubs or Espanyol with Spain', () => {
		expect(kitFor('Real Madrid').primary).not.toBe(kitFor('Real Sociedad').primary);
		expect(kitFor('Espanya (selecció)').primary).toBe('#c60b1e');
	});

	it('gives unknown teams a stable fallback colour', () => {
		expect(kitFor('Equip Desconegut').primary).toBe(kitFor('Equip Desconegut').primary);
		expect(kitFor(null, 'Algú').primary).toMatch(/^hsl\(/);
	});

	it('picks dark ink on light shirts and light ink on dark ones', () => {
		expect(kitFor('Real Madrid').ink).toBe('#141210');
		expect(kitFor('Bayern Munich').ink).toBe('#faf7f2');
	});
});

describe('initials', () => {
	it('uses first letters of the first two words', () => {
		expect(initials('Pedro Rodríguez')).toBe('PR');
		expect(initials('Trent Alexander-Arnold')).toBe('TA');
		expect(initials('Isco')).toBe('I');
		expect(initials('  ')).toBe('?');
	});
});
