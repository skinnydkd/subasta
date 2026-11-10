# Pla: backend de Supabase a Neon (aprovat 2026-11-10)

**Per què:** el compte de Supabase ja té els 2 projectes gratuïts permesos (les dues webs d'oposicions, amb usuaris actius) i `subasta` no es pot reactivar. Neon és Postgres gratuït que es desperta sol.

**Idea:** el navegador només parlava amb Supabase per al temps real; totes les accions de joc ja passaven pel servidor de SvelteKit. Les migracions i els seeds s'aprofiten sense tocar-los.

| Peça               | Abans (Supabase)                | Després (Neon)                                   |
| ------------------ | ------------------------------- | ------------------------------------------------ |
| Lògica de joc      | funcions SQL per RPC            | les mateixes, cridades amb SQL des del servidor  |
| Identitat          | compte anònim de Supabase       | galeta `httpOnly` signada (HMAC) amb un uuid     |
| Actualitzacions    | realtime + polling 1 s          | només polling 1 s                                |
| Presència          | canal de presència              | `room_members.last_seen_at`                      |
| Vincular email     | opció a la portada              | eliminat                                         |

## Passos (un commit cadascun)

1. `db/00_supabase_compat.sql`: esquemes `auth` i `extensions`, `auth.users`, `auth.uid()` (llig `app.user_id`), rols `anon`/`authenticated`, publicació `supabase_realtime` buida. `pnpm db:setup` aplica compat + migracions + seeds a `DATABASE_URL`.
2. `src/lib/server/db.ts` (driver de Neon): cada crida fixa `app.user_id` i executa la funció en la mateixa transacció. `src/lib/server/session.ts`: galeta signada.
3. `hooks.server.ts`, els tres fitxers d'RPC i les quatre lectures directes passen a `db.ts`.
4. Pàgina de sala: fora client i canals de Supabase; es queda el polling i el wake lock. Presència per `last_seen_at` (migració nova).
5. Fora `@supabase/*`, tipus generats i `gen-types`; `check` i `build` nets; docs.
6. Partida sencera amb Playwright i tres jugadors.

## Es perd

- Les pujes alienes es veuen amb fins a 1 s de retard (es pot baixar a 500 ms).
- Recuperar el compte per email: sense galeta es perd historial i estadístiques.

## Pendent de Pau

- Projecte Neon `subasta` (Frankfurt) i cadena de connexió al `.env` com a `DATABASE_URL`.
- Variables `DATABASE_URL` i `SESSION_SECRET` a Cloudflare en desplegar.
