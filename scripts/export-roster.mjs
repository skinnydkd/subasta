// Dumps every published theme's roster grouped by position to a markdown
// file the user can scan + mark up. One section per theme; one subsection
// per position; entries are "name (team, X M€)".

import 'dotenv/config';
import { writeFileSync } from 'node:fs';
import pg from 'pg';

const c = new pg.Client({
	connectionString: process.env.SUPABASE_DB_URL,
	ssl: { rejectUnauthorized: false }
});
await c.connect();

const themes = await c.query(`
  select t.slug, t.display_name,
    (select jsonb_agg(value) from jsonb_array_elements_text(t.filter_config -> 'include_tags') as value) as tags
  from public.themes t
  where t.is_published = true
  order by t.slug
`);

const POSITIONS = ['GK', 'RB', 'LB', 'CB', 'CM', 'RW', 'LW', 'ST'];
const POSITION_LABELS = {
	GK: 'Porter',
	RB: 'Lateral dret',
	LB: 'Lateral esquerre',
	CB: 'Central',
	CM: 'Migcampista',
	RW: 'Extrem dret',
	LW: 'Extrem esquerre',
	ST: 'Davanter'
};

const lines = [];
lines.push(`# Plantilles per tema i posició`);
lines.push(``);
lines.push(`Generat: ${new Date().toISOString()}`);
lines.push(``);
lines.push(`Marca amb \`[x]\` davant del nom els jugadors que **vols treure** del tema.`);
lines.push(`Marca amb \`[?]\` davant del nom els jugadors que tens dubtes.`);
lines.push(`Anota correccions de posició en la mateixa línia (p.ex. "→ LW").`);
lines.push(``);
lines.push(`---`);
lines.push(``);

for (const theme of themes.rows) {
	const tagSlugs = theme.tags ?? [];
	if (!tagSlugs.length) continue;

	const players = await c.query(
		`
    select distinct p.id, p.name, p.primary_position as pos,
      p.market_value_cents / 100000000 as value_m,
      p.metadata->>'team' as team,
      p.metadata->>'dev_seed_id' as seed_id
    from public.players p
    join public.player_tags pt on pt.player_id = p.id
    join public.tags tg on tg.id = pt.tag_id
    where tg.slug = ANY($1)
      and p.is_scrub = false
    order by p.primary_position, p.metadata->>'team', p.name
  `,
		[tagSlugs]
	);

	lines.push(`## ${theme.display_name}`);
	lines.push(``);
	lines.push(`Slug: \`${theme.slug}\` · Total: ${players.rows.length} jugadors`);
	lines.push(``);

	const byPos = {};
	for (const p of players.rows) (byPos[p.pos] ||= []).push(p);

	for (const pos of POSITIONS) {
		const list = byPos[pos] ?? [];
		if (list.length === 0) continue;
		lines.push(`### ${POSITION_LABELS[pos]} (${pos}) — ${list.length}`);
		lines.push(``);
		for (const p of list) {
			const team = p.team ? ` *(${p.team})*` : '';
			lines.push(`- [ ] ${p.name}${team} — ${p.value_m}M€  · \`${p.seed_id}\``);
		}
		lines.push(``);
	}

	lines.push(`---`);
	lines.push(``);
}

const dest = new URL('../docs/rosters.md', import.meta.url);
writeFileSync(dest, lines.join('\n'));
console.log(`Wrote ${dest.pathname}`);

await c.end();
