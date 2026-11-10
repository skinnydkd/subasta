# Auditoria de dades de jugadors (seeds 04..13) i contingut nou (seeds 14..21)

Data: 2026-11-10. Abast: `supabase/seed/04..13` (jugadors reals), correccions a `14_data_fixes.sql`,
contingut nou a `15..21`, verificació a `scripts/check-seeds.mjs`.

## 1. Mètode

1. Càrrega de tots els fitxers de `scripts/db-setup.mjs` en un PGlite en memòria (mateix ordre que una BD nova:
   `db/`, `supabase/migrations/`, `supabase/seed/`) i bolcat de tots els jugadors reals (no scrub, no `demo-%`).
2. Comparació de cada fila amb el JSON cru de Wikipedia (`scripts/*-squads-raw.json`) i amb coneixement propi del
   futbol (posició natural, club i temporada, plantilla).
3. Script de revisió contra les frases d'obertura de Wikipedia (`prop=extracts`, 20 títols per petició) per a
   les plantilles curades a mà i per a les temporades antigues de Barça, Madrid, Bayern i Liverpool.
4. Detecció de variants de nom (`(lower(name), birth_year)` és la clau de dedupe de `start_room`) i homònims.
5. Prova d'idempotència: càrrega completa, segona passada de `14..21`, comparació de comptes.

Límit: res de l'auditoria no és verificació contra una font oficial per jugador; és Wikipedia + coneixement propi.

## 2. Nombres

| | Abans | Després |
|---|---|---|
| Jugadors totals | 1080 | 2163 |
| Scrubs | 64 | 64 |
| Dev (`demo-%`) | 160 | 160 |
| Reals (files) | 856 | 1939 (837 vells + 1102 nous) |
| Reals (noms distints) | 721 | 1440 |
| Posicions canviades | | 85 |
| Noms canviats | | 9 |
| Files eliminades | | 19 |
| Temes publicats | 11 (un cop aplicat el 14) | 19 |

(Reals totals segons `check-seeds`: 2099, incloent les 160 files `demo-%`.)

## 3. Problemes trobats i què se n'ha fet

### 3.1 Bug d'ordre en BD nova (arrel de diversos errors)
Les migracions s'executen **abans** dels seeds. Les correccions de dades de les migracions (UPDATE de
posicions, desplublicar temes, DELETE de `player_tags`) no feien res en una BD nova perquè els jugadors encara no existien.
`14_data_fixes.sql` ho reaplica (secció A: Villarreal/Barça; secció E: temes). **Fet.**

### 3.2 Posicions incorrectes (85, secció B)
Principalment laterals marcats com a extrem o al revés, extrems com a davanter i migcampistes mal classificats.
Exemples: Dani Alves RB, Neymar LW, Cancelo RB, Júnior LW, Doku LW, Aït-Nouri LB, Dumfries RB, Adriano (Barça 14-15) LB,
Nicolás González (Atlético) LW. Llista completa a `14_data_fixes.sql` (claus per `dev_seed_id`). **Fet.**

### 3.3 Noms incorrectes o homònims (9, secció C)
- `rm1617-fernandez` era "Enzo Fernández"; és Enzo Zidane (Madrid 16-17). Altrament s'hauria fusionat amb l'Enzo del Chelsea.
- Normalitzats: Xavi, Dani Alves, Bojan, Jeffrén, Pedro (Barça 08-09), Nacho (Madrid 13-14), Andrew Robertson, Nicolás González.
- Rafinha: `birth_year` 1985 (Bayern 12-13) vs 1993 (Barça 14-15) perquè el dedupe els distingeixi. **Fet.**

### 3.4 Files que no són jugadors reals de la plantilla (19 eliminades, secció D)
Entrades d'acadèmia o equip filial sense minuts, rols tècnics, files duplicades del mateix jugador amb nom variant
(tres files "Tejero", `chelsea1112-supbsup`, `vil0708-rocha`, diverses del Bayern 25-26, Inter 25-26, Atlético i Man City 25-26).
Esborrades només si cap `auctions` les referencia (`ON DELETE RESTRICT`). **Fet.**

### 3.5 Temes no jugables
- `barca-2008-09` i `madrid-2002-03` es despubliquen (massa pocs jugadors per posició i ja cobertes pels temes històrics).
- `madrid-historic` passa a incloure `madrid-2002-03`, 13-14, 15-16, 16-17, 17-18. **Fet.**

### 3.6 Equip (`metadata.team`) nul
Els `demo-%` no tenien `team`; ara tenen `'Demo'`. Els reals ja en tenien. **Fet.**

### 3.7 Pendent o no resolt
- **demo-2026 no és jugable**: les dades dev reutilitzen els mateixos 20 noms entre posicions, i el dedupe de `start_room`
  per nom els redueix a 20 persones (CB 0, CM 0, RB 0). No s'ha tocat (dades de desenvolupament); convé despublicar-lo o eliminar-lo.
- **Temes "legacy" per sota dels mínims** (avís, no error a `check-seeds`): `barca-historic`, `clasicos-historic`, `madrid-historic`,
  `villarreal-historic`, `laliga-25-26` (GK 11, LW 6), `laliga-historicos` (GK 19, ST 23). Despublicar-los, ampliar-los
  o fusionar-los és decisió de producte.
- **Posicions dubtoses**: `ath-hierro` (l'extracte diu davanter, la taula DF), `vil0506-lopez` (Óscar López, possible enllaç equivocat),
  Marco Ruben (RW, com a la migració).
- **Valors de mercat**: són valors de "fama" aproximats (escala de les seeds 11/12), no cap font real. Aixafen el sorteig per `valor^2`.

## 4. Contingut nou (seeds 15..21)

44 plantilles, 1102 files, 8 temes nous.

| Fitxer | Contingut |
|---|---|
| 15 | Premier League 25-26: Chelsea 29, Tottenham 31, Man Utd 23, Newcastle 27, Aston Villa 32 |
| 16 | Serie A 25-26: Juventus 28, Milan 23, Roma 27, Atalanta 24, Lazio 29, Fiorentina 24 |
| 17 | Dortmund 23, Leverkusen 23, Benfica 23, Porto 28, Sporting 25, RB Leipzig 21, Marseille 22 (els dos últims, afegits per arribar als mínims) |
| 18 | Seleccions actuals: Espanya, Argentina, França, Brasil, Portugal, Anglaterra, Alemanya, Països Baixos (26 cadascuna), Itàlia (33) |
| 19 | Seleccions històriques: Espanya Euro 08, Mundial 10, Euro 12; Alemanya 14; Argentina 22; França 98 i 18; Itàlia 06; Brasil 02; Portugal Euro 16 (22-26 cadascuna) |
| 20 | Llegendes: Man Utd 98-99 i 07-08, Milan 02-03 i 06-07, Barça 05-06, Juventus 16-17, Liverpool 04-05 (22-27 cadascuna) |
| 21 | Temes: `premier-league-25-26`, `serie-a-25-26`, `bundesliga-ligue1-portugal-25-26`, `seleccions-actuals`, `seleccions-historiques`, `llegendes-futbol-europeu`, `top-lligues-25-26`, `tot-el-futbol` |

Notes:
- Itàlia no és al Mundial 2026: s'ha fet una selecció manual de 33 a partir de la pàgina de la selecció.
- Man Utd 25-26 ix de la taula d'estadístiques, per tant només hi ha jugadors amb partits.
- Cedits i traspassats fora de les plantilles s'han filtrat; la poda d'acadèmia és manual (`EXCLUDE` a `more-squads-data.mjs`).
- Les 7 llegendes són **curades a mà** (Wikipedia no té taula usable); la resta (37) són **rascades** de Wikipedia i corregides amb
  `POSITION_OVERRIDES` i `NAME_FIXES`. Les posicions d'extrems de plantilles històriques són en part sobreescriptures de coneixement propi.
- Per a les plantilles 2025-26 de grups pl/seriea/euro/natcur, la posició es reutilitza de les seeds ≤14 quan el jugador ja hi era.

## 5. Piscines finals per tema (noms distints, dedupe de `start_room`)

Mínims: GK/CB/CM/ST 25, LB/RB/LW/RW 12.

| Tema | GK | RB | LB | CB | CM | RW | LW | ST | Estat |
|---|---|---|---|---|---|---|---|---|---|
| bundesliga-ligue1-portugal-25-26 | 27 | 17 | 19 | 38 | 65 | 24 | 13 | 25 | ok |
| llegendes-futbol-europeu | 46 | 33 | 34 | 70 | 107 | 29 | 21 | 60 | ok |
| premier-league-25-26 | 28 | 22 | 21 | 49 | 64 | 24 | 20 | 25 | ok |
| seleccions-actuals | 28 | 19 | 16 | 43 | 71 | 21 | 16 | 27 | ok |
| seleccions-historiques | 25 | 15 | 16 | 35 | 53 | 12 | 13 | 27 | ok |
| serie-a-25-26 | 25 | 19 | 16 | 45 | 56 | 20 | 13 | 33 | ok |
| top-lligues-25-26 | 91 | 70 | 69 | 152 | 223 | 81 | 51 | 100 | ok |
| tot-el-futbol | 169 | 112 | 118 | 255 | 385 | 121 | 88 | 194 | ok |
| ucl-25-26 | 35 | 29 | 34 | 70 | 111 | 39 | 17 | 51 | ok |
| ucl-all | 60 | 45 | 52 | 106 | 178 | 55 | 29 | 82 | ok |
| ucl-historic | 28 | 20 | 21 | 40 | 74 | 16 | 13 | 34 | ok |
| demo | 170 | 115 | 123 | 253 | 387 | 125 | 93 | 196 | ok (dades dev) |
| barca-historic | 6 | 5 | 6 | 9 | 13 | 4 | 4 | 4 | WARN legacy |
| clasicos-historic | 13 | 10 | 10 | 17 | 28 | 9 | 9 | 11 | WARN legacy |
| laliga-25-26 | 11 | 12 | 13 | 23 | 41 | 15 | 6 | 18 | WARN legacy |
| laliga-historicos | 19 | 16 | 16 | 29 | 47 | 13 | 16 | 23 | WARN legacy |
| madrid-historic | 8 | 6 | 6 | 10 | 20 | 6 | 4 | 9 | WARN legacy |
| villarreal-historic | 7 | 6 | 6 | 12 | 19 | 4 | 7 | 12 | WARN legacy |
| demo-2026 | 12 | 0 | 2 | 0 | 0 | 3 | 1 | 2 | WARN legacy (injugable) |

## 6. Reproduir

```
node scripts/fetch-more-squads.mjs      # (opcional) torna a baixar de Wikipedia -> scripts/more-squads-raw.json
node scripts/build-more-seeds.mjs       # regenera supabase/seed/15..21
node scripts/check-seeds.mjs            # verifica; surt amb codi 1 si falla
```

`check-seeds` falla si: un jugador no scrub no té `team`; hi ha `dev_seed_id` duplicats; una posició no és de les 8 del joc;
un tag de tema no casa amb cap jugador; una piscina d'un tema no legacy queda per sota dels mínims. Els temes legacy només avisen.
