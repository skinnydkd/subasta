// Fetches UCL-relevant squads: 7 top European clubs current season (2025-26)
// + 7 historic UCL winners (2009-10 to 2019-20). Writes scripts/ucl-squads-raw.json.

import { writeFileSync } from 'node:fs';

const WIKI_RAW = 'https://en.wikipedia.org/w/index.php?action=raw&title=';
const WIKI_REST = 'https://en.wikipedia.org/api/rest_v1/page/summary/';
const USER_AGENT = 'subasta-ucl-fetcher/1.0 (https://github.com/skinnydkd/subasta)';

const SEASONS = [
	// Current top European clubs (2025-26). Some 25-26 season pages omit the
	// squad table — for those we read from the main club article which keeps
	// the current first-team squad up-to-date.
	{ key: 'mancity2526',   label: 'Manchester City 2025-26', page: 'Manchester City F.C.',                team: 'Manchester City 2025-26', tagSlug: 'mancity-25-26',   era: 'current' },
	{ key: 'arsenal2526',   label: 'Arsenal 2025-26',         page: 'Arsenal F.C.',                        team: 'Arsenal 2025-26',         tagSlug: 'arsenal-25-26',   era: 'current' },
	{ key: 'liverpool2526', label: 'Liverpool 2025-26',       page: '2025–26 Liverpool F.C. season',       team: 'Liverpool 2025-26',       tagSlug: 'liverpool-25-26', era: 'current' },
	{ key: 'psg2526',       label: 'PSG 2025-26',             page: '2025–26 Paris Saint-Germain FC season', team: 'PSG 2025-26',           tagSlug: 'psg-25-26',       era: 'current' },
	{ key: 'bayern2526',    label: 'Bayern Munich 2025-26',   page: '2025–26 FC Bayern Munich season',     team: 'Bayern Munich 2025-26',   tagSlug: 'bayern-25-26',    era: 'current' },
	{ key: 'inter2526',     label: 'Inter Milan 2025-26',     page: '2025–26 Inter Milan season',           team: 'Inter Milan 2025-26',    tagSlug: 'inter-25-26',     era: 'current' },
	{ key: 'napoli2526',    label: 'Napoli 2025-26',          page: '2025–26 SSC Napoli season',           team: 'Napoli 2025-26',          tagSlug: 'napoli-25-26',    era: 'current' },
	// Historic UCL winners 2010s. Bayern 12-13 and Liverpool 18-19 are
	// hand-curated in build-ucl-seeds.mjs because their Wikipedia season
	// pages lack squad templates.
	{ key: 'inter0910',     label: 'Inter Milan 2009-10 (UCL winner)',    page: '2009–10 Inter Milan season',          team: 'Inter Milan 2009-10',     tagSlug: 'inter-2009-10',     era: 'historic' },
	{ key: 'chelsea1112',   label: 'Chelsea 2011-12 (UCL winner)',         page: '2011–12 Chelsea F.C. season',         team: 'Chelsea 2011-12',         tagSlug: 'chelsea-2011-12',   era: 'historic' },
	{ key: 'madrid1516',    label: 'Real Madrid 2015-16 (UCL winner)',     page: '2015–16 Real Madrid CF season',       team: 'Real Madrid 2015-16',     tagSlug: 'madrid-2015-16',    era: 'historic' },
	{ key: 'madrid1718',    label: 'Real Madrid 2017-18 (UCL winner)',     page: '2017–18 Real Madrid CF season',       team: 'Real Madrid 2017-18',     tagSlug: 'madrid-2017-18',    era: 'historic' },
	{ key: 'bayern1920',    label: 'Bayern Munich 2019-20 (UCL winner)',   page: '2019–20 FC Bayern Munich season',     team: 'Bayern Munich 2019-20',   tagSlug: 'bayern-2019-20',    era: 'historic' }
];

const POSITION_OVERRIDES = {
	'Cristiano Ronaldo': 'LW',
	'Karim Benzema': 'ST',
	'Gareth Bale': 'RW',
	'Marcelo': 'LB',
	'Sergio Ramos': 'CB',
	'Raphaël Varane': 'CB',
	'Pepe': 'CB',
	'Iker Casillas': 'GK',
	'Keylor Navas': 'GK',
	"Mohamed Salah": 'RW',
	'Sadio Mané': 'LW',
	'Roberto Firmino': 'ST',
	'Virgil van Dijk': 'CB',
	'Trent Alexander-Arnold': 'RB',
	'Andrew Robertson': 'LB',
	'Jordan Henderson': 'CM',
	'Robert Lewandowski': 'ST',
	'Arjen Robben': 'RW',
	'Franck Ribéry': 'LW',
	'Thomas Müller': 'ST',
	'Manuel Neuer': 'GK',
	'Philipp Lahm': 'RB',
	'David Alaba': 'LB',
	'Bastian Schweinsteiger': 'CM',
	'Toni Kroos': 'CM',
	'Mario Mandžukić': 'ST',
	'Javi Martínez': 'CM',
	'Jérôme Boateng': 'CB',
	'Joshua Kimmich': 'CM',
	'Leroy Sané': 'RW',
	'Serge Gnabry': 'RW',
	'Kingsley Coman': 'LW',
	'Alphonso Davies': 'LB',
	'Frank Lampard': 'CM',
	'Didier Drogba': 'ST',
	'Fernando Torres': 'ST',
	'Juan Mata': 'CM',
	'Eden Hazard': 'LW',
	'Petr Čech': 'GK',
	'John Terry': 'CB',
	'Ashley Cole': 'LB',
	'Branislav Ivanović': 'CB',
	'David Luiz': 'CB',
	'Diego Milito': 'ST',
	'Samuel Eto\'o': 'RW',
	'Wesley Sneijder': 'CM',
	'Júlio César': 'GK',
	'Maicon': 'RB',
	'Esteban Cambiasso': 'CM',
	'Javier Zanetti': 'RB',
	'Walter Samuel': 'CB',
	'Lúcio': 'CB',
	'Erling Haaland': 'ST',
	'Kevin De Bruyne': 'CM',
	'Phil Foden': 'CM',
	'Bernardo Silva': 'CM',
	'Rodri': 'CM',
	'Jack Grealish': 'LW',
	'Bukayo Saka': 'RW',
	'Martin Ødegaard': 'CM',
	'Declan Rice': 'CM',
	'Gabriel Martinelli': 'LW',
	'Kai Havertz': 'ST',
	'William Saliba': 'CB',
	'Gabriel': 'CB',
	'Mohamed Salah': 'RW',
	'Cody Gakpo': 'LW',
	'Luis Díaz': 'LW',
	'Darwin Núñez': 'ST',
	'Alisson': 'GK',
	'Khvicha Kvaratskhelia': 'LW',
	'Victor Osimhen': 'ST',
	'Lautaro Martínez': 'ST',
	'Federico Dimarco': 'LB',
	'Hakan Çalhanoğlu': 'CM',
	'Nicolò Barella': 'CM',
	'Alessandro Bastoni': 'CB',
	'Yann Sommer': 'GK',
	'Ousmane Dembélé': 'RW',
	'Achraf Hakimi': 'RB',
	'Vitinha': 'CM',
	'João Neves': 'CM',
	'Désiré Doué': 'RW',
	'Marquinhos': 'CB'
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
	let dLink = 0; let dTpl = 0; let buf = '';
	for (let i = 0; i < body.length; i++) {
		const ch = body[i]; const next = body[i + 1];
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
	const sortname = raw.match(/\{\{sortname\s*\|\s*([^|}]*)\s*\|\s*([^|}]*)(?:\|\s*([^|}]*))?(?:\|[^}]*)?\}\}/i);
	if (sortname) {
		const first = sortname[1].trim();
		const last = sortname[2].trim();
		const article = (sortname[3] || '').trim();
		const display = (first + ' ' + last).trim();
		return { display, link: article || display };
	}
	const m = raw.match(/\[\[([^\]]+)\]\]/);
	let link = ''; let display = raw;
	if (m) {
		const inner = m[1];
		const pipe = inner.indexOf('|');
		if (pipe >= 0) { link = inner.slice(0, pipe).trim(); display = inner.slice(pipe + 1).trim(); }
		else { link = inner.trim(); display = inner.trim(); }
	}
	return { display: cleanWiki(display), link };
}

function normalizeName(name) {
	return name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function mapPosition(rawPos, refinement) {
	const p = (rawPos || '').toUpperCase().trim();
	const r = (refinement || '').toLowerCase();
	if (/\bright[ -]?wing(?:er)?\b/.test(r)) return 'RW';
	if (/\bleft[ -]?wing(?:er)?\b/.test(r)) return 'LW';
	if (p === 'GK' || p === 'G') return 'GK';
	if (p === 'RB' || p === 'RWB') return 'RB';
	if (p === 'LB' || p === 'LWB') return 'LB';
	if (p === 'CB' || p === 'SW') return 'CB';
	if (p === 'FB') return 'LB';
	if (p === 'RW' || p === 'RM') return 'RW';
	if (p === 'LW' || p === 'LM') return 'LW';
	if (p === 'ST' || p === 'CF' || p === 'SS') return 'ST';
	if (p === 'CM' || p === 'CDM' || p === 'DM' || p === 'CAM' || p === 'AM') return 'CM';
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
	const candidates = [player.wiki_title, player.name + ' (footballer)', player.name];
	let extract = '';
	for (const c of candidates) {
		const s = await fetchSummary(c);
		if (s && s.extract) { extract = s.extract; break; }
	}
	const refinement = refineFromExtract(extract);
	let mapped = mapPosition(player.pos_raw, refinement);
	if (POSITION_OVERRIDES[player.name]) mapped = POSITION_OVERRIDES[player.name];
	return { mapped, refinement, extract: extract.slice(0, 180) };
}

const out = {};

for (const s of SEASONS) {
	process.stdout.write(`\n=== ${s.label} ===\n  `);
	try {
		const wikitext = await fetchWikitext(s.page);
		const raw = extractFromWikitext(wikitext);
		process.stdout.write(`${raw.length} raw entries`);

		const seenName = new Set(); const seenTitle = new Set();
		const deduped = [];
		for (const p of raw) {
			const kN = normalizeName(p.name);
			const kT = normalizeName(p.wiki_title);
			if (seenName.has(kN) || (kT && seenTitle.has(kT))) continue;
			seenName.add(kN);
			if (kT) seenTitle.add(kT);
			deduped.push(p);
		}

		const enriched = [];
		for (const p of deduped) {
			const meta = await enrichPlayer(p);
			enriched.push({ ...p, ...meta });
			await sleep(220);
		}

		// For current-season clubs apply mild reserve filter (number ≥ 40 + young).
		// For historic, keep all (squad already curated by the season being over).
		const filtered = enriched.filter((p) => {
			if (!p.number && !p.extract) return false;
			if (s.era === 'current' && p.number && p.number > 40) {
				const born = /born\s+\d{1,2}\s+\w+\s+(20\d\d)/i.exec(p.extract || '');
				if (born && parseInt(born[1], 10) >= 2006) return false;
			}
			return true;
		});

		out[s.key] = { ...s, squad: filtered };
		process.stdout.write(` → ${filtered.length} kept\n`);
	} catch (err) {
		console.log(`\n  FAILED: ${err.message}`);
		out[s.key] = { ...s, error: err.message };
	}
}

const dest = new URL('./ucl-squads-raw.json', import.meta.url);
writeFileSync(dest, JSON.stringify(out, null, 2));
console.log(`\nWrote ${dest.pathname}`);

for (const [, s] of Object.entries(out)) {
	if (s.error) continue;
	const by = {};
	for (const p of s.squad) {
		const k = p.mapped || `??(${p.pos_raw || '-'})`;
		(by[k] ||= []).push(p.name);
	}
	console.log(`\n--- ${s.label} (${s.squad.length}) ---`);
	for (const pos of ['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST']) {
		if (!by[pos]) continue;
		console.log(`  ${pos}: ${by[pos].join(', ')}`);
	}
	for (const [pos, names] of Object.entries(by)) {
		if (['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST'].includes(pos)) continue;
		console.log(`  ${pos}: ${names.join(', ')}`);
	}
}
