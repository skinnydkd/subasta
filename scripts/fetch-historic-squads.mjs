// Fetches historic squads (multiple clubs × multiple seasons) from Wikipedia
// and writes scripts/historic-squads-raw.json. Reuses the parser shape from
// fetch-squads.mjs but does NOT apply the reserve/loan-out filter — for
// historic seasons we want the full squad (loans-IN like Tacchinardi at
// Villarreal 05-06 are part of that season's story).

import { writeFileSync } from 'node:fs';

const WIKI_RAW = 'https://en.wikipedia.org/w/index.php?action=raw&title=';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const USER_AGENT = 'subasta-historic-squad-fetcher/1.0 (https://github.com/skinnydkd/subasta)';

const SEASONS = [
	{ clubKey: 'bar', clubLabel: 'FC Barcelona', seasonKey: 'bar1011', seasonLabel: '2010-11', page: '2010–11 FC Barcelona season', dispTeam: 'FC Barcelona 2010-11' },
	{ clubKey: 'bar', clubLabel: 'FC Barcelona', seasonKey: 'bar1415', seasonLabel: '2014-15', page: '2014–15 FC Barcelona season', dispTeam: 'FC Barcelona 2014-15' },
	{ clubKey: 'rm',  clubLabel: 'Real Madrid', seasonKey: 'rm1314', seasonLabel: '2013-14', page: '2013–14 Real Madrid CF season', dispTeam: 'Real Madrid 2013-14' },
	{ clubKey: 'rm',  clubLabel: 'Real Madrid', seasonKey: 'rm1617', seasonLabel: '2016-17', page: '2016–17 Real Madrid CF season', dispTeam: 'Real Madrid 2016-17' },
	{ clubKey: 'vil', clubLabel: 'Villarreal CF', seasonKey: 'vil0506', seasonLabel: '2005-06', page: '2005–06 Villarreal CF season', dispTeam: 'Villarreal CF 2005-06' },
	{ clubKey: 'vil', clubLabel: 'Villarreal CF', seasonKey: 'vil0708', seasonLabel: '2007-08', page: '2007–08 Villarreal CF season', dispTeam: 'Villarreal CF 2007-08' },
	{ clubKey: 'vil', clubLabel: 'Villarreal CF', seasonKey: 'vil1011', seasonLabel: '2010-11', page: '2010–11 Villarreal CF season', dispTeam: 'Villarreal CF 2010-11' }
];

// Player-name overrides where the Wikipedia summary heuristic mislabels the
// position. Keyed by player display name (same form printed by the scraper).
const POSITION_OVERRIDES = {
	'Lionel Messi': 'RW',
	'Andrés Iniesta': 'CM',
	'Pedro Rodríguez': 'LW',
	'David Villa': 'LW',
	'Cristiano Ronaldo': 'LW',
	'Karim Benzema': 'ST',
	'Gareth Bale': 'RW',
	'Marcelo': 'LB',
	'Sergio Ramos': 'CB',
	'Raphaël Varane': 'CB',
	'Pepe': 'CB',
	'Iker Casillas': 'GK',
	'Roberto Carlos': 'LB',
	'Zinédine Zidane': 'CM',
	'Luís Figo': 'RW',
	'Ronaldo': 'ST',
	'Raúl': 'ST',
	'Diego Forlán': 'ST',
	'Juan Román Riquelme': 'CM',
	'Marcos Senna': 'CM',
	'Santi Cazorla': 'CM',
	'Roger García': 'LW',
	'Javier Calleja': 'RW',
	'Robert Pires': 'LW',
	'Giuseppe Rossi': 'ST',
	'Joan Capdevila': 'LB',
	'Marco Ruben': 'ST',
	'Nilmar': 'ST'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWikitext(title) {
	const url = WIKI_RAW + encodeURIComponent(title.replace(/ /g, '_'));
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) throw new Error(`Wikipedia ${res.status} for ${title}`);
	return await res.text();
}

async function fetchSummary(title) {
	const url = WIKI_REST + encodeURIComponent(title.replace(/ /g, '_'));
	const res = await fetch(url, {
		headers: { 'User-Agent': USER_AGENT, accept: 'application/json' }
	});
	if (!res.ok) return null;
	const data = await res.json();
	if (data.type === 'disambiguation') return null;
	return data;
}

function splitParams(body) {
	const parts = [];
	let dLink = 0;
	let dTpl = 0;
	let buf = '';
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		const next = body[i + 1];
		if (ch === '[' && next === '[') { dLink++; buf += '[['; i++; continue; }
		if (ch === ']' && next === ']') { dLink--; buf += ']]'; i++; continue; }
		if (ch === '{' && next === '{') { dTpl++; buf += '{{'; i++; continue; }
		if (ch === '}' && next === '}') { dTpl--; buf += '}}'; i++; continue; }
		if (ch === '|' && dLink === 0 && dTpl === 0) { parts.push(buf); buf = ''; continue; }
		buf += ch;
	}
	if (buf) parts.push(buf);
	const params = {};
	for (const part of parts) {
		const eq = part.indexOf('=');
		if (eq < 0) continue;
		params[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
	}
	return params;
}

function cleanWiki(s) {
	if (!s) return '';
	let out = s.replace(/<!--[\s\S]*?-->/g, '');
	out = out.replace(/\{\{[^{}]*\}\}/g, '');
	out = out.replace(/'''?([^']+)'''?/g, '$1');
	return out.trim();
}

function parseName(raw) {
	if (!raw) return { display: '', link: '' };
	// {{sortname|First|Last|Article title (optional)}} — renders as "First Last".
	const sortname = raw.match(/\{\{sortname\s*\|\s*([^|}]*)\s*\|\s*([^|}]*)(?:\|\s*([^|}]*))?(?:\|[^}]*)?\}\}/i);
	if (sortname) {
		const first = sortname[1].trim();
		const last = sortname[2].trim();
		const article = (sortname[3] || '').trim();
		const display = (first + ' ' + last).trim();
		return { display, link: article || display };
	}
	const m = raw.match(/\[\[([^\]]+)\]\]/);
	let link = '';
	let display = raw;
	if (m) {
		const inner = m[1];
		const pipe = inner.indexOf('|');
		if (pipe >= 0) { link = inner.slice(0, pipe).trim(); display = inner.slice(pipe + 1).trim(); }
		else { link = inner.trim(); display = inner.trim(); }
	}
	display = cleanWiki(display);
	return { display, link };
}

function normalizeName(name) {
	return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function mapPosition(rawPos, refinement) {
	const p = (rawPos || '').toUpperCase().trim();
	const r = (refinement || '').toLowerCase();
	if (/\bright[ -]?wing(?:er)?\b/.test(r)) return 'RW';
	if (/\bleft[ -]?wing(?:er)?\b/.test(r)) return 'LW';

	// Direct specific codes (older Wikipedia infobox tables use these).
	if (p === 'GK' || p === 'G') return 'GK';
	if (p === 'RB' || p === 'RWB') return 'RB';
	if (p === 'LB' || p === 'LWB') return 'LB';
	if (p === 'CB' || p === 'SW') return 'CB';
	if (p === 'FB') return 'LB'; // generic full-back → default LB
	if (p === 'RW' || p === 'RM') return 'RW';
	if (p === 'LW' || p === 'LM') return 'LW';
	if (p === 'ST' || p === 'CF' || p === 'SS') return 'ST';
	if (p === 'CM' || p === 'CDM' || p === 'DM' || p === 'CAM' || p === 'AM') return 'CM';

	// Broad codes (current-season pages use these).
	if (p === 'DF' || p === 'DEF' || p === 'D') {
		if (/\b(right[ -]?back|right[ -]?wing[ -]?back)\b/.test(r)) return 'RB';
		if (/\b(left[ -]?back|left[ -]?wing[ -]?back)\b/.test(r)) return 'LB';
		return 'CB';
	}
	if (p === 'MF' || p === 'MID' || p === 'M') return 'CM';
	if (p === 'FW' || p === 'FWD' || p === 'F') {
		if (/\bwinger\b/.test(r)) return 'RW';
		return 'ST';
	}
	return null;
}

function extractFromWikitext(wikitext) {
	const results = [];
	const patterns = [
		{ re: /\{\{Fs player\b([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g, nameKey: 'name', numKey: 'no', posKey: 'pos' },
		{ re: /\{\{Efs player2?\b([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g, nameKey: 'name', numKey: 'no', posKey: 'pos' },
		{ re: /\{\{fb si player\b([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g, nameKey: 'p', numKey: 'n', posKey: 'pos' }
	];
	for (const { re, nameKey, numKey, posKey } of patterns) {
		re.lastIndex = 0;
		let m;
		while ((m = re.exec(wikitext)) !== null) {
			const params = splitParams(m[1]);
			const rawName = params[nameKey] || '';
			const { display, link } = parseName(rawName);
			if (!display) continue;
			const num = parseInt(cleanWiki(params[numKey] || ''), 10);
			results.push({
				name: display,
				wiki_title: link || display,
				number: Number.isFinite(num) ? num : null,
				pos_raw: cleanWiki(params[posKey] || '')
			});
		}
	}
	return results;
}

function refineFromExtract(extract) {
	if (!extract) return '';
	const m = extract.match(/plays?\s+as\s+(?:a|an)\s+([a-z- ]{3,40})(?:\s+for|\s+in|\s+with|\s+and|\.|,|$)/i);
	return m ? m[1].trim() : '';
}

async function enrichPlayer(player) {
	const candidates = [
		player.wiki_title,
		player.name + ' (footballer)',
		player.name + ' (Spanish footballer)',
		player.name + ' (Argentine footballer)',
		player.name + ' (Brazilian footballer)',
		player.name
	];
	let extract = '';
	for (const c of candidates) {
		const s = await fetchSummary(c);
		if (s && s.extract) { extract = s.extract; break; }
	}
	const refinement = refineFromExtract(extract);
	let mapped = mapPosition(player.pos_raw, refinement);
	if (POSITION_OVERRIDES[player.name]) mapped = POSITION_OVERRIDES[player.name];
	return { mapped, refinement, extract: extract.slice(0, 200) };
}

// --------------------------------------------------------------------------

const out = {};

for (const s of SEASONS) {
	process.stdout.write(`\n=== ${s.dispTeam} ===\n  Fetching… `);
	try {
		const wikitext = await fetchWikitext(s.page);
		const raw = extractFromWikitext(wikitext);
		console.log(`${raw.length} raw entries`);

		// Dedup within a single season (some pages list the same player in
		// multiple tables, e.g. squad + stats).
		const seen = new Set();
		const seenTitle = new Set();
		const deduped = [];
		for (const p of raw) {
			const k = normalizeName(p.name);
			const kT = normalizeName(p.wiki_title);
			if (seen.has(k) || (kT && seenTitle.has(kT))) continue;
			seen.add(k);
			if (kT) seenTitle.add(kT);
			deduped.push(p);
		}

		const enriched = [];
		for (const p of deduped) {
			const meta = await enrichPlayer(p);
			enriched.push({ ...p, ...meta });
			await sleep(220);
		}

		// Light filter: drop entries with no number AND no extract (B-team noise).
		const squad = enriched.filter((p) => p.number || p.extract);

		out[s.seasonKey] = {
			clubKey: s.clubKey,
			clubLabel: s.clubLabel,
			seasonKey: s.seasonKey,
			seasonLabel: s.seasonLabel,
			dispTeam: s.dispTeam,
			page: s.page,
			squad
		};

		console.log(`  → ${squad.length} kept`);
	} catch (err) {
		console.log(`FAILED: ${err.message}`);
		out[s.seasonKey] = { ...s, error: err.message };
	}
}

const dest = new URL('./historic-squads-raw.json', import.meta.url);
writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`\nWrote ${dest.pathname}`);

for (const [, s] of Object.entries(out)) {
	if (s.error) continue;
	const by = {};
	for (const p of s.squad) {
		const k = p.mapped || `??(${p.pos_raw || '-'})`;
		(by[k] ||= []).push(p.name);
	}
	console.log(`\n--- ${s.dispTeam} (${s.squad.length}) ---`);
	for (const pos of ['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST']) {
		if (!by[pos]) continue;
		console.log(`  ${pos}: ${by[pos].join(', ')}`);
	}
	for (const [pos, names] of Object.entries(by)) {
		if (['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST'].includes(pos)) continue;
		console.log(`  ${pos}: ${names.join(', ')}`);
	}
}
