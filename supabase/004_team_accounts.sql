-- Team accounts for live testing on real phones (idempotent; safe to re-run).
--   Sarosh: speaks Urdu, Heirloom off.   Victor: speaks English, Heirloom on, learning Urdu.
-- The client's persona picker lists them by these ids (client/src/lib/cast.ts).
insert into profiles (id, display_name, language) values
  ('00000000-0000-0000-0000-000000000006', 'Sarosh', 'ur'),
  ('00000000-0000-0000-0000-000000000007', 'Victor', 'en')
on conflict (id) do nothing;

insert into threads (id) values
  ('00000000-0000-0000-0000-0000000000a5')
on conflict (id) do nothing;

insert into thread_members (thread_id, profile_id) values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000006'),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000007')
on conflict do nothing;

insert into thread_settings (thread_id, profile_id, learning_enabled, learning_lang) values
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000006', false, null),
  ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-000000000007', true, 'ur')
on conflict (thread_id, profile_id) do nothing;
