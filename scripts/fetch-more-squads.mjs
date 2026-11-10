// Fetches squads for the "15_*" seeds (extra clubs, national teams, legends)
// from rendered Wikipedia HTML (action=parse), so it works whatever wikitext
// template a page uses (Fs player, Nat fs g player, plain wikitable...).
// Writes scripts/more-squads-raw.json. Then run scripts/build-more-seeds.mjs.
//
// Usage: node scripts/fetch-more-squads.mjs [key ...]   (no keys = all)
// Network politeness: ~1 s between requests, descriptive User-Agent.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { SQUADS } from './more-squads-config.mjs';

const API = 'https://en.wikipedia.org/w/api.php?format=json&formatversion=2&';
const UA = 'subasta-seed-fetcher/1.0 (hobby football auction game; contact via GitHub skinnydkd/subasta)';
const DEST = new URL('./more-squads-raw.json', import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(params) {
	for (let attempt = 0; attempt < 6; attempt++) {
		const res = await fetch(API + new URLSearchParams(params), { headers: { 'User-Agent': UA } });
		const text = await res.text();
		if (res.ok && text.startsWith('{')) {
			await sleep(1000);
			return JSON.parse(text);
		}
		// 429 / "too many requests": back off hard, then retry.
		await sleep(8000 * (attempt + 1));
	}
	throw new Error(`API failed for ${JSON.stringify(params).slice(0, 120)}`);
}

const decode = (s) =>
	s
		.replace(/&#160;|&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#0?39;|&#x27;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));

const stripTags = (s) =>
	decode(
		s
			.replace(/<span style="display:\s*none[^"]*">[\s\S]*?<\/span>/g, '') // hidden sort keys
			.replace(/<sup[\s\S]*?<\/sup>/g, '')
			.replace(/<[^>]+>/g, '')
	)
		.replace(/\s+/g, ' ')
		.trim();

// First non-flag, non-image link in a cell -> {text, title}
function firstPlayerLink(cellHtml) {
	const cleaned = cellHtml
		.replace(/<span class="flagicon">[\s\S]*?<\/span>\s*<\/span>/g, '')
		.replace(/<span class="flagicon">[\s\S]*?<\/span>/g, '')
		.replace(/<sup[\s\S]*?<\/sup>/g, '');
	const re = /<a\s+[^>]*?href="\/wiki\/([^"#]+)"[^>]*?(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/a>/g;
	let m;
	while ((m = re.exec(cleaned)) !== null) {
		const text = stripTags(m[3]);
		if (!text) continue;
		const title = decode(m[2] || decodeURIComponent(m[1]).replace(/_/g, ' '));
		if (/^File:/.test(title)) continue;
		const red = /class="new"/.test(m[0]);
		return { text, title: title.replace(/ \(page does not exist\)$/, ''), red };
	}
	return null;
}

const POS_RE = /^(GK|G|DF|DEF|D|MF|MID|M|FW|FWD|F|CB|LB|RB|WB|LWB|RWB|DM|CDM|CM|AM|CAM|LM|RM|LW|RW|CF|ST|SS|SW)\b/i;

function parseHtml(html) {
	const out = [];
	// Walk headings + tables in order so each row knows its sub-heading.
	const tokens = [...html.matchAll(/<h([2-5])[^>]*id="([^"]*)"|<table[\s\S]*?<\/table>/g)];
	let group = '';
	for (const t of tokens) {
		if (t[1]) {
			group = decode(t[2]).replace(/_/g, ' ');
			continue;
		}
		const table = t[0];
		const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => r[1]);
		let cols = null;
		for (const row of rows) {
			const cells = [...row.matchAll(/<(t[dh])[^>]*?(?:colspan="(\d+)")?[^>]*>([\s\S]*?)<\/\1>/g)].map((c) => ({
				tag: c[1],
				html: c[3],
				text: stripTags(c[3])
			}));
			if (cells.length === 0) continue;
			if (cells.every((c) => c.tag === 'th') && cells.length >= 3) {
				const names = cells.map((c) => c.text.toLowerCase());
				const player = names.findIndex((n) => /^(player|name)/.test(n));
				const pos = names.findIndex((n) => /^pos/.test(n));
				const no = names.findIndex((n) => /^(no|#|nº|n°)/.test(n));
				// stats tables have a 2nd header row ("Apps | Goals ..."): keep the columns of the 1st
				if (player >= 0 && pos >= 0) cols = { player, pos, no, n: Math.min(cells.length, 6) };
				continue;
			}
			if (!cols || cells.length < cols.n - 1) continue;
			// Some rows use a <th> for the player name (Fs player) -> cells line up with header order anyway.
			const posCell = cells[cols.pos]?.text || '';
			if (!POS_RE.test(posCell)) continue;
			const link = firstPlayerLink(cells[cols.player]?.html || '');
			const name = link?.text || cells[cols.player]?.text;
			if (!name || /^(player|name)$/i.test(name)) continue;
			const num = cols.no >= 0 ? parseInt(cells[cols.no]?.text, 10) : NaN;
			out.push({ name, wiki_title: link?.title || name, red: !!link?.red, number: Number.isFinite(num) ? num : null, pos_raw: posCell, group });
		}
	}
	return out;
}

const sectionCache = new Map(); // tournament pages are huge: list their sections once
async function findSection(page, matchers, nth = 0) {
	if (!sectionCache.has(page)) sectionCache.set(page, (await api({ action: 'parse', page, prop: 'sections' })).parse.sections);
	const secs = sectionCache.get(page);
	const hits = secs.filter((x) => matchers.some((re) => re.test(x.line)));
	return { all: secs, hit: hits[nth] };
}

async function fetchSectionRows(page, matchers) {
	for (let nth = 0; nth < 4; nth++) {
		const { hit } = await findSection(page, matchers, nth);
		if (!hit) break;
		const h = await api({ action: 'parse', page, prop: 'text', section: hit.index });
		const rows = parseHtml(h.parse.text);
		if (rows.length >= 8) return { rows, section: hit.line };
	}
	return { rows: [], section: null };
}

async function fetchTeamFromTournament(page, teamName) {
	const { all } = await findSection(page, []);
	const idx = all.find((x) => x.line.toLowerCase() === teamName.toLowerCase() && x.toclevel >= 2);
	if (!idx) return { rows: [], section: null };
	const h = await api({ action: 'parse', page, prop: 'text', section: idx.index });
	return { rows: parseHtml(h.parse.text), section: idx.line };
}

async function enrich(rows) {
	const titles = [...new Set(rows.filter((r) => !r.red).map((r) => r.wiki_title))];
	const extracts = new Map();
	for (let i = 0; i < titles.length; i += 20) {
		const chunk = titles.slice(i, i + 20);
		const res = await api({
			action: 'query',
			prop: 'extracts',
			exintro: '1',
			explaintext: '1',
			exsentences: '3',
			exlimit: 'max',
			redirects: '1',
			titles: chunk.join('|')
		});
		const back = new Map();
		for (const n of res.query?.normalized || []) back.set(n.to, n.from);
		const redirects = new Map();
		for (const r of res.query?.redirects || []) redirects.set(r.to, r.from);
		for (const p of res.query?.pages || []) {
			let from = p.title;
			const r1 = redirects.get(p.title);
			if (r1) from = r1;
			const n1 = back.get(from);
			if (n1) from = n1;
			extracts.set(from, (p.extract || '').replace(/\s+/g, ' ').slice(0, 420));
			extracts.set(p.title, (p.extract || '').replace(/\s+/g, ' ').slice(0, 420));
		}
	}
	return rows.map((r) => ({ ...r, extract: extracts.get(r.wiki_title) || '' }));
}

const only = process.argv.slice(2);
const out = existsSync(DEST) ? JSON.parse(readFileSync(DEST, 'utf8')) : {};

for (const s of SQUADS) {
	if (only.length && !only.includes(s.key)) continue;
	if (s.inline) continue; // hand-curated in the config, nothing to fetch
	if (!only.length && out[s.key]?.squad?.length) continue; // already fetched: pass the key to refresh it
	process.stdout.write(`${s.key} (${s.page}${s.teamSection ? ' > ' + s.teamSection : ''}) ... `);
	try {
		const got = s.teamSection
			? await fetchTeamFromTournament(s.page, s.teamSection)
			: await fetchSectionRows(s.page, [/^(first[- ]team( squad)?|squad( information| list)?|current squad|players|team)$/i, /squad/i]);
		const seen = new Set();
		const rows = got.rows.filter((r) => {
			const k = r.wiki_title.toLowerCase();
			if (seen.has(k)) return false;
			seen.add(k);
			return true;
		});
		const enriched = await enrich(rows);
		out[s.key] = { ...s, section: got.section, squad: enriched };
		console.log(`${enriched.length} players (section: ${got.section})`);
	} catch (e) {
		console.log(`FAILED ${e.message}`);
		out[s.key] = { ...s, error: e.message, squad: [] };
	}
	writeFileSync(DEST, JSON.stringify(out, null, 1));
}
console.log('done');
