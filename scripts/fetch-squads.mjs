// Fetches current-season squads from Wikipedia and writes a structured JSON
// to scripts/squads-raw.json for human inspection before generating the seed.
//
// Two passes:
//   1) Parse the team season page wikitext, extract squad templates
//      ({{Fs player}}, {{Efs player2}}, {{fb si player}}). Filter out
//      reserve/B-team/youth/loaned-out players.
//   2) For each player, fetch their individual Wikipedia summary and parse
//      "plays as a <position>" to refine RB/LB/CB and RW/LW/ST. Apply manual
//      overrides for known misclassifications.

import { writeFileSync } from 'node:fs';

const WIKI_RAW = 'https://en.wikipedia.org/w/index.php?action=raw&title=';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const USER_AGENT = 'subasta-squad-fetcher/1.0 (https://github.com/skinnydkd/subasta)';

const TEAMS = [
	{ key: 'rm', label: 'Real Madrid', page: '2025–26 Real Madrid CF season' },
	{ key: 'bar', label: 'Barcelona', page: '2025–26 FC Barcelona season' },
	{ key: 'atm', label: 'Atlético Madrid', page: '2025–26 Atlético Madrid season' },
	{ key: 'ath', label: 'Athletic Club', page: '2025–26 Athletic Bilbao season' },
	{ key: 'rso', label: 'Real Sociedad', page: '2025–26 Real Sociedad season' }
];

// Manual overrides for cases where Wikipedia extracts mislead the heuristic.
// Keyed by player display name (use the form printed by the scraper).
const POSITION_OVERRIDES = {
	'Aihen Muñoz': 'LB',
	'Iñigo Lekue': 'RB',
	'Adama Boiro': 'LB',
	'Marcus Rashford': 'LW',
	'Brahim Díaz': 'RW',
	'Dani Olmo': 'CM',
	'Ferran Torres': 'LW'
};

// Substrings in the player's Wikipedia summary that flag reserve/loan/youth
// and disqualify them from the first-team squad.
const RESERVE_HINTS = [
	'Castilla',
	'Real Madrid B',
	'Barcelona Atlètic',
	'Bilbao Athletic',
	'Athletic Club B',
	'Real Sociedad B',
	'Atlético Madrid B',
	'youth team',
	'youth system',
	'reserve team',
	'on loan at',
	'on loan to',
	'on a season-long loan',
	'currently on loan'
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWikitext(title) {
	const url = WIKI_RAW + encodeURIComponent(title.replace(/ /g, '_'));
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
	if (!res.ok) throw new Error(`Wikipedia returned ${res.status} for ${title}`);
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

// Split a template body by top-level pipes, respecting [[…]] and {{…}}.
function splitParams(body) {
	const parts = [];
	let dLink = 0;
	let dTpl = 0;
	let buf = '';
	for (let i = 0; i < body.length; i++) {
		const ch = body[i];
		const next = body[i + 1];
		if (ch === '[' && next === '[') {
			dLink++;
			buf += '[[';
			i++;
			continue;
		}
		if (ch === ']' && next === ']') {
			dLink--;
			buf += ']]';
			i++;
			continue;
		}
		if (ch === '{' && next === '{') {
			dTpl++;
			buf += '{{';
			i++;
			continue;
		}
		if (ch === '}' && next === '}') {
			dTpl--;
			buf += '}}';
			i++;
			continue;
		}
		if (ch === '|' && dLink === 0 && dTpl === 0) {
			parts.push(buf);
			buf = '';
			continue;
		}
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
	const m = raw.match(/\[\[([^\]]+)\]\]/);
	let link = '';
	let display = raw;
	if (m) {
		const inner = m[1];
		const pipe = inner.indexOf('|');
		if (pipe >= 0) {
			link = inner.slice(0, pipe).trim();
			display = inner.slice(pipe + 1).trim();
		} else {
			link = inner.trim();
			display = inner.trim();
		}
	}
	display = cleanWiki(display);
	return { display, link };
}

// Normalized name for deduplication (strip accents, lowercase, collapse spaces).
function normalizeName(name) {
	return name
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/\s+/g, ' ')
		.trim();
}

// Refine raw position (GK/DF/MF/FW) with the player's wiki extract.
function mapPosition(rawPos, refinement) {
	const p = (rawPos || '').toUpperCase().trim();
	const r = (refinement || '').toLowerCase();

	// Winger keywords win regardless of raw template position — Wikipedia's
	// {{Fs player}} pos field often labels a winger as FW, MF, or DF.
	if (/\bright[ -]?wing(?:er)?\b/.test(r)) return 'RW';
	if (/\bleft[ -]?wing(?:er)?\b/.test(r)) return 'LW';

	if (p === 'GK' || p === 'G' || p === 'GOALKEEPER') return 'GK';
	if (p === 'DF' || p === 'DEF' || p === 'D' || p === 'DEFENDER') {
		if (/\b(right[ -]?back|right[ -]?wing[ -]?back)\b/.test(r)) return 'RB';
		if (/\b(left[ -]?back|left[ -]?wing[ -]?back)\b/.test(r)) return 'LB';
		return 'CB';
	}
	if (p === 'MF' || p === 'MID' || p === 'M' || p === 'MIDFIELDER') return 'CM';
	if (p === 'FW' || p === 'FWD' || p === 'F' || p === 'FORWARD') {
		if (/\bwinger\b/.test(r)) return 'RW'; // generic — manual override may correct
		return 'ST';
	}
	return null;
}

// Pull every player template from a team season page. We keep the squad
// number when present; reserves/youth typically lack one or use 30+.
function extractFromWikitext(wikitext) {
	const results = [];
	const patterns = [
		{
			re: /\{\{Fs player\b([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g,
			nameKey: 'name',
			numKey: 'no',
			posKey: 'pos',
			otherKey: 'other'
		},
		{
			re: /\{\{Efs player2?\b([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g,
			nameKey: 'name',
			numKey: 'no',
			posKey: 'pos',
			otherKey: null
		},
		{
			re: /\{\{fb si player\b([^{}]*(?:\{\{[^{}]*\}\}[^{}]*)*)\}\}/g,
			nameKey: 'p',
			numKey: 'n',
			posKey: 'pos',
			otherKey: null
		}
	];

	for (const { re, nameKey, numKey, posKey, otherKey } of patterns) {
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
				pos_raw: cleanWiki(params[posKey] || ''),
				pos_other: otherKey ? cleanWiki(params[otherKey] || '') : ''
			});
		}
	}
	return results;
}

function refineFromExtract(extract) {
	if (!extract) return '';
	const m = extract.match(
		/plays?\s+as\s+(?:a|an)\s+([a-z- ]{3,40})(?:\s+for|\s+in|\s+with|\s+and|\.|,|$)/i
	);
	return m ? m[1].trim() : '';
}

function isReserveExtract(extract) {
	if (!extract) return false;
	const lower = extract.toLowerCase();
	return RESERVE_HINTS.some((hint) => lower.includes(hint.toLowerCase()));
}

async function enrichPlayer(player) {
	const candidates = [
		player.wiki_title,
		player.name + ' (footballer)',
		player.name + ' (Spanish footballer)',
		player.name
	];
	let summary = null;
	for (const c of candidates) {
		const s = await fetchSummary(c);
		if (s && s.extract) {
			summary = s;
			break;
		}
	}
	const extract = summary?.extract || '';
	const refinement = refineFromExtract(extract);
	let mapped = mapPosition(player.pos_raw, refinement || player.pos_other);
	if (POSITION_OVERRIDES[player.name]) mapped = POSITION_OVERRIDES[player.name];
	return {
		mapped,
		refinement,
		extract: extract.slice(0, 220), // truncate for the JSON file
		reserve: isReserveExtract(extract)
	};
}

// ----------------------------- run -----------------------------------------

const out = {};

for (const t of TEAMS) {
	process.stdout.write(`\n=== ${t.label} ===\n  Fetching season page… `);
	try {
		const wikitext = await fetchWikitext(t.page);
		const raw = extractFromWikitext(wikitext);
		console.log(`${raw.length} raw entries`);

		// Dedup by normalized name AND by wiki title — handles "Dani Vivian" vs
		// "Daniel Vivian" (same article) and "Álex" vs "Alex" (same article).
		const seenName = new Set();
		const seenTitle = new Set();
		const deduped = [];
		for (const p of raw) {
			const kName = normalizeName(p.name);
			const kTitle = normalizeName(p.wiki_title);
			if (seenName.has(kName) || (kTitle && seenTitle.has(kTitle))) continue;
			seenName.add(kName);
			if (kTitle) seenTitle.add(kTitle);
			deduped.push(p);
		}

		const enriched = [];
		for (const p of deduped) {
			const meta = await enrichPlayer(p);
			enriched.push({ ...p, ...meta });
			await sleep(220);
		}

		// First-team filter:
		//   - drop entries flagged as reserve/loan/youth via extract hints
		//   - drop entries with no squad number AND no extract (B-team noise)
		//   - drop entries with a high squad number (>30) AND a birth year ≥
		//     2006 in the extract (typical reserve-team age in 2025-26)
		const firstTeam = enriched.filter((p) => {
			if (p.reserve) return false;
			if (!p.number && !p.extract) return false;
			if (p.number && p.number > 30) {
				const bornMatch = /born\s+\d{1,2}\s+\w+\s+(20\d\d)/i.exec(p.extract || '');
				if (bornMatch && parseInt(bornMatch[1], 10) >= 2006) return false;
			}
			return true;
		});

		out[t.key] = {
			label: t.label,
			page: t.page,
			squad: firstTeam,
			dropped: enriched.length - firstTeam.length
		};

		console.log(`  → ${firstTeam.length} first-team (dropped ${enriched.length - firstTeam.length})`);
	} catch (err) {
		console.log(`FAILED: ${err.message}`);
		out[t.key] = { label: t.label, page: t.page, error: err.message };
	}
}

const dest = new URL('./squads-raw.json', import.meta.url);
writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`\nWrote ${dest.pathname}`);

for (const [, team] of Object.entries(out)) {
	if (team.error) continue;
	const by = {};
	for (const p of team.squad) {
		const k = p.mapped || `??(${p.pos_raw || '-'})`;
		(by[k] ||= []).push(p.name);
	}
	console.log(`\n--- ${team.label} (${team.squad.length}) ---`);
	for (const pos of ['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST']) {
		if (!by[pos]) continue;
		console.log(`  ${pos}: ${by[pos].join(', ')}`);
	}
	for (const [pos, names] of Object.entries(by)) {
		if (['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST'].includes(pos)) continue;
		console.log(`  ${pos}: ${names.join(', ')}`);
	}
}
