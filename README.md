# subasta

**App PWA per a subhastes de jugadors de futbol amb amics.** 3-5 jugadors online, 1.000M€ inicials, temes configurables, votació final. Pensada per a partides amb amics on cadascú està al seu mòbil.

> Estat: **scaffolding inicial**. Vegeu [Roadmap](#roadmap-mvp).

## Com es juga

1. **Crea una sala** o uneix-te amb un codi de 6 caràcters.
2. **El host configura la partida**: tema (p.ex. *La Liga 25-26* o *Barça històric*), formació (4-3-3, 4-4-2…), jugadors per posició disponibles a la subhasta, tipus de subhasta i durada del timer.
3. **Subhasta lliure amb timer**: es presenta un jugador. Tothom pot pujar; cada puja reinicia el timer (1 min per defecte). Si no hi ha pujes durant el timer, s'adjudica al darrer postor. Si no n'hi ha hagut cap, queda sense adjudicar i passa a la pool de buits.
4. **Acaparament permès**: pots gastar tot el pressupost en més d'un jugador d'una mateixa posició. Avís: si et quedes sense un porter, l'app te n'assigna automàticament un d'**ofici dolent** de la *scrub pool* del tema.
5. **Votació final**: cadascú fa un ranking top-3 dels equips dels altres (3 pts al millor, 2 al segon, 1 al tercer). No pots votar el teu propi equip. Qui més punts sumi guanya.

## Stack

| Capa     | Tecnologia                                       |
|----------|--------------------------------------------------|
| Frontend | SvelteKit 2 (Svelte 5 runes), TS, Tailwind v4    |
| Backend  | Supabase (Postgres + Realtime + Auth + Storage)  |
| Deploy   | Cloudflare Pages (`@sveltejs/adapter-cloudflare`)|
| Tests    | Vitest (unit), Playwright (e2e)                  |

## Setup local

> Prerequisits: Node 20+, pnpm, Docker (per a Supabase local), Supabase CLI.

```bash
# 1. clona i instal·la
pnpm install

# 2. arrenca Supabase local
supabase start          # imprimirà URL local + claus

# 3. copia les claus al .env
cp .env.example .env    # i edita amb les claus que t'ha donat 'supabase start'

# 4. aplica migrations + seed
supabase db reset       # reaplica tota la migració + seed

# 5. genera types TypeScript des del schema
pnpm db:types

# 6. dev
pnpm dev
```

L'app estarà a `http://localhost:5173`. El Supabase studio local a `http://localhost:54323`.

## Estructura

```
subasta/
├── CLAUDE.md                      # guia per a Claude Code
├── README.md                      # aquest fitxer
├── supabase/
│   ├── migrations/                # SQL versionat
│   └── seed/                      # tags, themes, players inicials
├── src/
│   ├── lib/
│   │   ├── auction/               # auction engine (interfície + variants)
│   │   ├── supabase/              # client + types generats
│   │   ├── stores/                # estat reactiu (room, auction, user)
│   │   ├── components/            # ui, room, auction, lobby, voting
│   │   ├── server/                # endpoints SSR / form actions
│   │   ├── utils/                 # currency, room codes, helpers
│   │   └── types/                 # types compartits del domain + db
│   └── routes/
│       ├── (auth)/                # login, signup
│       ├── room/
│       │   ├── new/               # crear sala
│       │   ├── join/              # join per codi
│       │   └── [code]/            # lobby + draft + voting + results
│       └── api/                   # endpoints servidor si calen
├── static/                        # icons PWA, manifest
└── tests/                         # unit + e2e
```

## Roadmap MVP

| Fase | Què                                                                  | Estat |
|------|----------------------------------------------------------------------|-------|
| 1    | Scaffolding, schema SQL, CLAUDE.md, README                           | ✅    |
| 2    | Init SvelteKit + Supabase local + auth + types generats              | ⏳    |
| 3    | Lobby, room creation, codi de sala, configuració de partida          | ⏳    |
| 4    | Auction engine `open_timer` + Realtime sync + auto-scrub             | ⏳    |
| 5    | Votació + resultats + share                                          | ⏳    |
| 6    | Seed: La Liga 25-26 + Barça/Madrid/Villarreal històrics              | ⏳    |
| 7    | Polish UI dark mode "no-IA", PWA install, anti-disconnect            | ⏳    |

### v2 (post-MVP)

- Tipus de subhasta: sobre tancat 1st-price, sobre tancat 2nd-price (Vickrey), per torns.
- Mescla de tipus de subhasta per posició dins d'una mateixa partida.
- Més temes (Premier League, Top 5 europeus, seleccions, llegendes, Ballon d'Or…).
- Historial de partides per usuari.
- Mode "lliga": múltiples partides amb classificació acumulada.

## Decisions de disseny clau

- **Diners en cèntims**: `bigint`, no `numeric`. 1.000M€ = `100_000_000_000n`. Format només a la capa UI.
- **Auction engine amb interfície**: tots els tipus de subhasta implementen el mateix contracte. MVP només `open_timer`; afegir variants no toca la resta del codi.
- **Anti-cheat server-side**: tota mutació de joc passa per RPC de Postgres amb validació. RLS estricte a totes les taules.
- **Realtime**: Postgres Changes per a estat persistent, Broadcast per a esdeveniments efímers (countdowns, "X està pujant…").

## Llicència

Privat — projecte personal de Pau.
