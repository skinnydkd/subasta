-- The machine's players (src/lib/bots/roster.ts). Real auth users with fixed
-- ids so they can join rooms and bid through the normal game functions; the
-- on_auth_user_created trigger creates their profiles. Idempotent.

insert into auth.users (id, raw_user_meta_data)
values
	('b0700000-0000-4000-8000-000000000001', '{"display_name": "El Tàctic"}'),
	('b0700000-0000-4000-8000-000000000002', '{"display_name": "L''Estrella"}'),
	('b0700000-0000-4000-8000-000000000003', '{"display_name": "El Tacany"}'),
	('b0700000-0000-4000-8000-000000000004', '{"display_name": "L''Impulsiu"}'),
	('b0700000-0000-4000-8000-000000000005', '{"display_name": "El Franctirador"}')
on conflict (id) do nothing;
