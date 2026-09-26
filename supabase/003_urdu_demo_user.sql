-- Urdu demo user: Dada (ur) in a thread with Arjun (en).
-- Safe to re-run: every insert is guarded by on conflict.
insert into profiles (id, display_name, language) values
  ('00000000-0000-0000-0000-000000000004', 'Dada',   'ur')
on conflict (id) do nothing;

insert into threads (id) values
  ('00000000-0000-0000-0000-0000000000a3')
on conflict (id) do nothing;

insert into thread_members (thread_id, profile_id) values
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-000000000004')
on conflict do nothing;
