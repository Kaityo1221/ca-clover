-- Synthetic-only fixture for 20261013_ca_master_minimal_barrier.sql.
-- Run in GitHub Actions' disposable PostgreSQL service, never in production.
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE TABLE public.sync_automation_state (
  id integer PRIMARY KEY,
  last_ca_master_at timestamptz NOT NULL
);
INSERT INTO public.sync_automation_state VALUES
  (1,'2099-01-01T00:00:00Z');

CREATE TABLE public.community_ca_members (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  community_id uuid NOT NULL,
  ca_member_id uuid NOT NULL,
  UNIQUE(community_id,ca_member_id)
);
CREATE TABLE public.user_ca_identities (
  user_id uuid NOT NULL,
  community_id uuid NOT NULL,
  ca_member_id uuid NOT NULL,
  CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
    FOREIGN KEY (community_id,ca_member_id)
    REFERENCES public.community_ca_members(community_id,ca_member_id)
    ON DELETE CASCADE NOT DEFERRABLE
);
INSERT INTO public.community_ca_members(community_id,ca_member_id) VALUES
 ('00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002');
INSERT INTO public.user_ca_identities(user_id,community_id,ca_member_id) VALUES
 ('00000000-0000-4000-8000-000000000003',
  '00000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002');
