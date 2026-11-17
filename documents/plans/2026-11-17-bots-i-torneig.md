# Plan: bots («la màquina») i torneig simulat

## Context
Pau vol poder jugar sol contra bots i que el guanyador es decidisca per un torneig simulat (idea: 7a0.com.br). Ara el guanyador ix d'una votació entre humans, que no té sentit amb bots. Decisions de Pau: amb bots decideix la **simulació** (sales només d'humans conserven la votació; el host pot triar simulació en qualsevol sala); format **lliga ida i volta + final** entre els dos primers.

## Disseny

### 1. Bots com a membres reals (sense tocar el SQL de joc)
- 5 usuaris bot amb UUID fix, sembrats a `supabase/seed/23_bots.sql` (`auth.users` + trigger de `profiles`, `on conflict do nothing`). Noms fictis amb estil: El Tacany, L'Estrella, El Tàctic, L'Impulsiu, El Franctirador. Mai noms de persones reals.
- Els bots criden les mateixes RPC (`join_room`, `place_bid`) amb el seu id (`rpc(botId, …)`), així totes les validacions anti-trampes ja existents s'apliquen igual.
- `src/lib/bots/roster.ts`: UUID → {nom, estil}. `rooms.ts`: `addBot(hostId, roomId)` / `removeBot` (el host pot expulsar-los amb el `kickMember` existent).

### 2. Cervell del bot (funció pura, amb tests): `src/lib/bots/strategy.ts`
`decideBid(snapshot, bot, rng) → centims | null`, amb snapshot = subhasta activa, jugador (`market_value_cents`), pressupost, plantilla per posició, formació+extres, subhastes pendents (`upcoming_auctions`), `now`.
Regles perquè tinga gràcia:
1. **Mai trencar la caixa**: reserva = (llocs encara per cobrir − 1) × puja mínima d'obertura.
2. **Només pugen on els cal**: posició ja plena (formació + extres) → no puja (llevat del Franctirador, que acapara estrelles).
3. **Valoració** = valor de mercat × factor d'estil (Tacany 0,7; Estrella 1,3 per als >60 M€ i 0,5 per als altres; Tàctic 1,0 amb bonus d'escassetat; Impulsiu 1,0–1,6 aleatori) × soroll segons dificultat (fàcil ±40 %, normal ±20 %, difícil ±8 % + planifica pressupost).
4. **Bonus d'escassetat**: si queden poques subhastes de la posició que li falta, valora +15–30 %.
5. **Temps de reacció**: no contraoferta fins 1–3 s després d'una puja nova; no puja sobre si mateix.
6. **Increment**: normalment el mínim; l'Impulsiu fa salts de +2 passos per intimidar.
7. **Franctirador**: espera als últims 5–6 s i fa una sola puja forta.
8. Mai passa de la seua valoració ni del seu pressupost (la RPC ho rebutjaria igualment).

### 3. Qui fa jugar els bots (sense procés en segon pla)
`botTick(view)` des del `load` de `src/routes/room/[code]/+page.server.ts` quan l'estat és `drafting` i hi ha bots: cada sondeig d'un humà (cada 1 s) fa que cada bot decidisca; només si `decideBid` torna una puja es fa la RPC. Les rondes concurrents són segures (límit de 200 ms i «no pots pujar sobre tu»). Si cap humà sondeja, la partida es pausa (acceptable). Els bots compten sempre com a «connectats» a `onlineUserIds`. L'autoavançament del temps ja és del client (`DraftPanel`).

### 4. Torneig simulat: `src/lib/sim/` (pur, determinista, amb tests)
- `rating.ts`: valor de mercat → valoració 40–96 (`52 + 14·log10(M€)`, retallada; scrub/auto = 45). Línies: porter, defensa (LB/RB/CB), mig (CM), atac (LW/RW/ST).
- `match.ts`: gols esperats λ = 1,3·exp((atac·0,6 + mig·0,4 − (def·0,5 + mig·0,3 + porter·0,2)) / 18); gols per Poisson amb PRNG (`mulberry32`) sembrat amb `roomId` + parella → **el mateix resultat per a tots els clients, sense guardar res a la BD**. Golejadors triats per pesos (ST 5, LW/RW 3, CM 1,5, resta 0,3).
- `tournament.ts`: lliga ida i volta, classificació (punts, diferència, gols), final dels dos primers (prorroga + penals si empaten; amb 2 equips només hi ha la final), campió i màxim golejador.
- `settings.result_mode`: `'vote' | 'simulation'` (nova clau a `RoomSettings`, que les RPC ja admeten com a JSON; el servidor la fixa a `simulation` si hi ha bots i el host pot canviar-la al lobby).

### 5. Interfície
- **Inici**: botó destacat «Jugar contra la màquina» (tema + nombre de bots 1–4 + dificultat) → acció `createSoloRoom` que crea la sala, afegeix els bots i deixa a l'humà com a host.
- **Lobby (host)**: «Afegir bot» / treure bot; selector «Com es decideix: Torneig / Votació».
- **Fase «voting» en mode simulació** (`VotingPanel` → nou `TournamentPanel.svelte`): botó del host «Simular torneig» (crida `finishVoting`, que no exigeix vots) i revelació progressiva dels partits (respecta `prefers-reduced-motion`).
- **Resultats** (`ResultsPanel`): si `result_mode === 'simulation'`, classificació + partits + final + campió + màxim golejador, i els camps (`Pitch`) com ara.
- Etiqueta «bot» a `MemberList`; samarreta/nom del bot amb el mateix `PlayerAvatar`.
- Les partides amb bots no compten per a les estadístiques de victòries.

## Fitxers principals
Nous: `supabase/seed/23_bots.sql`, `src/lib/bots/{roster,strategy}.ts` (+ tests), `src/lib/sim/{rating,match,tournament,rng}.ts` (+ tests), `src/lib/components/room/TournamentPanel.svelte`.
Canviats: `src/lib/server/rooms.ts`, `src/routes/+page.server.ts` i `+page.svelte`, `src/routes/room/[code]/+page.server.ts` (`botTick`, accions `addBot`/`simulate`), `LobbyPanel`, `ResultsPanel`, `MemberList`, `src/lib/auction/settings.ts`, `CLAUDE.md`.
Reutilitzat: `rpc`/`query` (`src/lib/server/db.ts`), `kitFor`/`PlayerAvatar`, `FORMATION_PRESETS`, `themeMaxMembers` (el límit del tema també limita humans + bots).

## Verificació
- Tests unitaris: l'estratègia respecta pressupost, posició plena i reserva; el simulador és determinista (mateixa llavor → mateix resultat), els equips més forts guanyen amb més freqüència en 1.000 simulacions, la final sempre té campió.
- E2E nou: 1 humà + 3 bots juguen un draft complet (el test fa de humà: puja i avança), arriba al torneig, simula i veu campió; un segon test comprova que el límit de tema compta els bots.
- Prova manual al navegador a 375 i 1440 px, mirant que els bots pugen amb ritme natural i no s'arruïnen.
- `check`, `vitest`, `playwright test`, `node scripts/check-seeds.mjs`.

## Fora d'abast / riscos
- Si ningú sondeja, els bots no juguen (no hi ha procés en segon pla). Més sondejos amb bots = més consultes a Neon (poques: només quan decideixen pujar).
- No hi ha «mode repte 7-0» ni rivals llegendaris; es pot afegir després reutilitzant `src/lib/sim/`.
- Les valoracions surten dels valors de mercat aproximats de les dades: el torneig és un joc, no una predicció real.
