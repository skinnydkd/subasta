## Project Configuration

- **Language**: TypeScript
- **Package Manager**: pnpm
- **Add-ons**: prettier, eslint, vitest, playwright, tailwindcss

---

# subasta — Project guide for Claude Code

> Aquest fitxer complementa el global `~/.claude/CLAUDE.md`. Aquí van **convencions específiques d'aquest projecte**. Si veus contradicció entre ambdós, mana aquest.

## Què és

App PWA de subhasta de jugadors de futbol amb amics. 3-5 jugadors online sincronitzat, codi de sala, 1.000M€ inicials, temes configurables (lligues, clubs històrics, seleccions...). Cada partida es trauen jugadors per posició a subhasta i al final es vota el millor equip. Vegeu `README.md` per a regles completes.

## Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (runes), TypeScript estricte, Tailwind CSS v4
- **Backend**: Postgres a Neon (`@neondatabase/serverless`, HTTP). Tota la lògica de joc en funcions SQL; el servidor de SvelteKit és l'únic que parla amb la BD (`src/lib/server/db.ts`)
- **Deploy**: Cloudflare Pages (adaptador `@sveltejs/adapter-cloudflare`)
- **PWA**: service worker manual (`src/service-worker.ts`)
- **Tests**: Vitest (unit), Playwright (e2e)

## Comandes

```bash
pnpm dev              # dev server
pnpm build            # production build
pnpm preview          # preview production build local
pnpm test             # vitest watch
pnpm test:unit        # vitest una passada
pnpm test:e2e         # playwright
pnpm lint             # eslint + prettier check
pnpm format           # prettier write
pnpm db:setup         # BD NOVA: compat + migracions + seeds (necessita DATABASE_URL)
node scripts/run-sql.mjs <fitxer.sql>   # aplicar una migració nova
node tests/test_*.mjs # tests SQL (transacció amb rollback)
```

## Domain model — conceptes clau

- **Theme** = un conjunt curat de jugadors filtrat per tags (p.ex. `laliga-25-26`, `barca-historic`). Tot tema té **scrub pool** associada (jugadors d'ofici dolents per posició).
- **Room** = sala de joc amb codi de 6 chars, hostessa, tema triat, settings de la partida (formació, jugadors per posició, tipus de subhasta, timer...).
- **Auction** = subhasta individual d'**un** jugador dins d'una room. Estats: `pending → active → closed | auto_assigned`. Una room té N×11 + extres auctions.
- **Bid** = puja dins d'una auction (només subhastes de tipus `open_timer` al MVP).
- **Vote** = ranking top-3 final (3-2-1 pts), no inclou el votant.

## Convencions específiques d'aquest projecte

### Auction engine — interfície estable

Hi haurà múltiples tipus de subhasta. **Sempre** afegir-los implementant la interfície a `src/lib/auction/engine.ts`. Mai afegir lògica de tipus específic dins de routes/components — sempre passar pel motor. MVP només `open_timer`; v2 afegirà `sealed_first`, `sealed_vickrey`, `turn_based`.

### Diners en cèntims (bigint)

Tots els imports en BD i lògica de negoci són **bigint en cèntims d'euro** (`bigint`, no `numeric`, no `int`). 1.000M€ = 100_000_000_000n. Format només a la capa de presentació (`src/lib/utils/currency.ts`).

### Estat en viu: polling

No hi ha canal push. La pàgina de sala fa `invalidateAll()` cada 1 s en subhasta (2,5 s a lobby/votació, 3 s els espectadors) i el servidor torna `get_room_view`. La presència ix de `room_members.last_seen_at`.

### Identitat

Galeta `uid` `httpOnly` signada amb HMAC (`src/lib/server/session.ts`). `db.query(userId, …)` fixa `app.user_id` dins la transacció i `auth.uid()` el llig (`db/00_supabase_compat.sql`). Sense comptes ni email.

### Anti-cheat / consistència

Tota acció que muta estat de joc (puja, vot, tancar subhasta) **ha de** passar per una funció SQL amb validació server-side. **Mai** confiar al client per al `current_bid` o el `budget_remaining`.

### Naming

- DB: `snake_case` per a taules i columnes.
- TS: `camelCase` per a variables/funcions, `PascalCase` per a tipus i components.
- Components Svelte: `PascalCase.svelte`.
- Routes: `kebab-case` o conveni SvelteKit (`+page.svelte`, etc.).

### Tests

- **Unit obligatori** per a `src/lib/auction/*` (motor de subhasta) i `src/lib/utils/*` (currency, room codes, etc.).
- **Integration**: `tests/*.mjs` contra `DATABASE_URL`.
- **E2E** Playwright només per als happy paths principals.

### Commits (sobre el global)

- Sempre conventional commits.
- `feat(auction):`, `fix(realtime):`, `chore(db):` són els scopes més comuns.

## Seguretat — atenció especial

- `DATABASE_URL` i `SESSION_SECRET` només al servidor (`$env/dynamic/private`). El navegador no parla mai amb la BD.
- Les migracions antigues encara creen polítiques RLS; no fan res perquè l'app connecta com a propietari. La seguretat és a les funcions SQL (`auth.uid()`).
- **No** validar mai pertinença a una sala només al client.
- **Rate limit** a les pujes (per RPC, p.ex. max 1 puja per usuari cada 200ms).

## Estat actual / roadmap

Veure `README.md` secció "Roadmap MVP". Fases:

Fases 1-7 del MVP fetes (flux complet: lobby → subhasta `open_timer` → auto-scrub → votació → resultats, seeds reals, PWA). Represa el 2026-11-10: fase 0 (tornar a arrancar), fase 1 (acabar: decisions pendents, partir `room/[code]/+page.svelte`), fase 2 (disseny + v2).

## Gotchas

- **Windows ARM64**: `workerd` no té build i peta en importar-lo; `svelte.config.js` se salta `adapter-cloudflare` en eixa plataforma. Dev, check i tests funcionen; el build de producció es fa als builders Linux de Cloudflare.
- **pnpm** no està instal·lat globalment al PC de Pau: `npx pnpm@10 <ordre>`.
- Les migracions són a `supabase/migrations/` per història; ja no hi ha Supabase. `db/00_supabase_compat.sql` crea el que esperen (`auth.users`, `auth.uid()`, rols).
- **Sense `DATABASE_URL`**, `pnpm dev` usa un Postgres en memòria (PGlite, `src/lib/server/db.local.ts`) muntat amb els mateixos SQL; es buida en reiniciar. Els e2e (`npx playwright test`) corren així, contra `vite dev` al port 5174.
- Pla de la migració: `documents/plans/2026-11-10-neon-migration.md`.

## Decisions resoltes

- **Paleta dark mode**: warm blacks + warm greys + sport-bar red accent. NO blaus. Tokens a `src/app.css`.
- **Auth**: només nom + galeta signada. Cap email.
- **Ordre dels jugadors a subhasta**: random per room.

## Decisions pendents abans de codi (revisar amb usuari)

- Què passa amb diners no gastats al final (bonus / penalització / res).
- UX per a jugadors amb sospita de cheating o desconnectats llargament.
- Detalls del sobre tancat 1st/2nd-price (per a v2; ambdós ja decidits com a opcions).

## Referències ràpides

- Driver Neon: <https://github.com/neondatabase/serverless>
- adapter-cloudflare: <https://kit.svelte.dev/docs/adapter-cloudflare>
