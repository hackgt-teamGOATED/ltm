-- Demo people and threads. Fixed IDs so you can reset and re-seed easily.
insert into profiles (id, display_name, language) values
  ('00000000-0000-0000-0000-000000000001', 'Arjun',  'en'),
  ('00000000-0000-0000-0000-000000000002', 'Nani',   'hi'),
  ('00000000-0000-0000-0000-000000000003', 'Abuela', 'es')
on conflict (id) do nothing;

insert into threads (id) values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2')
on conflict (id) do nothing;

insert into thread_members (thread_id, profile_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-000000000003')
on conflict do nothing;

-- Urdu demo: Dada reads and writes Urdu, in a thread with Arjun.
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
