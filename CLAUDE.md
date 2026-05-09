# subasta — Project guide for Claude Code

> Aquest fitxer complementa el global `~/.claude/CLAUDE.md`. Aquí van **convencions específiques d'aquest projecte**. Si veus contradicció entre ambdós, mana aquest.

## Què és

App PWA de subhasta de jugadors de futbol amb amics. 3-5 jugadors online sincronitzat, codi de sala, 1.000M€ inicials, temes configurables (lligues, clubs històrics, seleccions...). Cada partida es trauen jugadors per posició a subhasta i al final es vota el millor equip. Vegeu `README.md` per a regles completes.

## Stack

- **Frontend**: SvelteKit 2 + Svelte 5 (runes), TypeScript estricte, Tailwind CSS v4
- **Backend**: Supabase (Postgres + Realtime + Auth + Storage)
- **Deploy**: Cloudflare Pages (adaptador `@sveltejs/adapter-cloudflare`)
- **PWA**: vite-pwa o manual (decidir a fase 1)
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
pnpm db:types         # genera src/lib/types/db.ts des de Supabase
pnpm db:reset         # reset local + reaplica migrations + seed
pnpm db:push          # push migrations a Supabase remote
```

(Comandes definitives: revisar `package.json` quan estiga inicialitzat.)

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

### Realtime: Postgres Changes vs Broadcast

- **Postgres Changes**: per a estat persistent (auction status, current_bid, budget). Cada subscripció escolta canvis a una row específica.
- **Broadcast**: per a esdeveniments efímers (countdown ticks, animacions de puja, "X està pujant..."). No es persisteix.

Regla: si l'estat ha de sobreviure a un refresh, va per Postgres Changes. Si no, Broadcast.

### Anti-cheat / consistència

Tota acció que muta estat de joc (puja, vot, tancar subhasta) **ha de** passar per Edge Functions o RPC de Postgres amb validació server-side. **Mai** confiar al client per al `current_bid` o el `budget_remaining`. RLS estricte per a totes les taules de joc.

### Naming

- DB: `snake_case` per a taules i columnes.
- TS: `camelCase` per a variables/funcions, `PascalCase` per a tipus i components.
- Components Svelte: `PascalCase.svelte`.
- Routes: `kebab-case` o conveni SvelteKit (`+page.svelte`, etc.).

### Tests

- **Unit obligatori** per a `src/lib/auction/*` (motor de subhasta) i `src/lib/utils/*` (currency, room codes, etc.).
- **Integration** amb Supabase local per a flux complet de room → draft → voting.
- **E2E** Playwright només per als happy paths principals.

### Commits (sobre el global)

- Sempre conventional commits.
- `feat(auction):`, `fix(realtime):`, `chore(db):` són els scopes més comuns.

## Seguretat — atenció especial

- **Claus Supabase**: només la `anon` al client. La `service_role` NOMÉS a Edge Functions o scripts locals (mai checked-in).
- **RLS obligatori** a totes les taules. Cap taula sense policy.
- **No** validar mai pertinença a una sala només al client.
- **Rate limit** a les pujes (per RPC, p.ex. max 1 puja per usuari cada 200ms).

## Estat actual / roadmap

Veure `README.md` secció "Roadmap MVP". Fases:
1. ✅ Scaffold + schema + CLAUDE.md (aquest commit)
2. ⏳ Init SvelteKit + Supabase local + auth bàsica + types generats
3. ⏳ Lobby + room creation + room code join
4. ⏳ Auction engine (`open_timer`) + realtime
5. ⏳ Auto-scrub + voting + results
6. ⏳ Seed inicial (La Liga 25-26, Barça/Madrid/Villarreal històrics)
7. ⏳ Polish UI (dark mode "no-IA", PWA install, anti-disconnect)

## Decisions pendents abans de codi (revisar amb usuari)

- Estètica concreta del dark mode (preference user té un typo a aclarir: "negros y azules" mentre diu "no azules" — confirmar paleta).
- Ordre dels jugadors a subhasta dins d'una room (random / per posició / mixt).
- Què passa amb diners no gastats al final (bonus / penalització / res).
- UX per a jugadors amb sospita de cheating o desconnectats llargament.
- Detalls del sobre tancat 1st/2nd-price (per a v2; ambdós ja decidits com a opcions).

## Referències ràpides

- Supabase Realtime: <https://supabase.com/docs/guides/realtime>
- SvelteKit + Supabase: <https://supabase.com/docs/guides/auth/server-side/sveltekit>
- adapter-cloudflare: <https://kit.svelte.dev/docs/adapter-cloudflare>
