---
name: db-migration
description: 'Write an additive, RLS-locked Supabase migration file for the human to apply. Use for any schema change.'
---

# Write a database migration

1. Create the next numbered file: `supabase/00N_description.sql`.
2. Additive only: `create table if not exists`, `create index if not exists`,
   `alter table … add column if not exists`.
3. Enable row-level security on every new table with no policies (server key only), like `001_init.sql`.
4. Never drop, truncate or rewrite existing tables or columns. Never edit `001_init.sql`.
5. Tell the human the file name to apply in the Supabase SQL editor. Don't apply it yourself.
6. Schema changes beyond PLAN.md §5.2 need the human's approval first.
