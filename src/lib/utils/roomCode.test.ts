import { describe, expect, it } from 'vitest';
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from './roomCode';

describe('generateRoomCode', () => {
	it('generates a 6-char string', () => {
		const code = generateRoomCode();
		expect(code).toHaveLength(6);
	});

	it('only contains characters from the unambiguous alphabet', () => {
		for (let i = 0; i < 200; i++) {
			expect(isValidRoomCode(generateRoomCode())).toBe(true);
		}
	});

	it('avoids ambiguous characters (0/O, 1/I/L)', () => {
		for (let i = 0; i < 200; i++) {
			const code = generateRoomCode();
			expect(code).not.toMatch(/[01ILO]/);
		}
	});
});

describe('isValidRoomCode', () => {
	it.each([
		['ABC234', true],
		['XYZ789', true],
		['ABC23', false], // too short
		['ABC2345', false], // too long
		['ABC0DE', false], // contains 0
		['ABCID3', false], // contains I
		['abc234', false] // lowercase
	])('returns %s for "%s"', (input, expected) => {
		expect(isValidRoomCode(input)).toBe(expected);
	});
});

describe('normalizeRoomCode', () => {
	it('uppercases and trims', () => {
		expect(normalizeRoomCode('  abc234  ')).toBe('ABC234');
	});
});
