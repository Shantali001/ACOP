create table if not exists settings (
  id integer primary key default 1 check (id = 1),
  organization_name text not null default 'AMSAF',
  organization_logo text,
  theme text not null default 'light',
  backup_enabled boolean not null default false,
  password_policy jsonb not null default '{"minLength":8,"requireNumbers":false,"requireSymbols":false}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into settings (id, organization_name, theme, backup_enabled, password_policy)
values (1, 'AMSAF', 'light', false, '{"minLength":8,"requireNumbers":false,"requireSymbols":false}'::jsonb)
on conflict (id) do nothing;

-- password_policy stores Module 15 password settings as JSONB:
-- { "minLength": number, "requireNumbers": boolean, "requireSymbols": boolean }
-- organization_logo stores either null (use bundled logo) or an uploaded data URL.