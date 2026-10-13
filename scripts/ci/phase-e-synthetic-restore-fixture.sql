-- Synthetic only. Must connect to ephemeral Postgres 17 CI DB.
\set ON_ERROR_STOP on
DO $guard$
BEGIN
 IF current_database()<>'ca_master_safety'
 OR inet_server_addr() IS NULL
 THEN RAISE EXCEPTION 'STOP: synthetic CI database only'; END IF;
END $guard$;
BEGIN;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users(id text PRIMARY KEY, marker text NOT NULL);
CREATE TABLE auth.identities(id text PRIMARY KEY, user_id text NOT NULL REFERENCES auth.users(id));
CREATE TABLE public.profiles(user_id text PRIMARY KEY REFERENCES auth.users(id),marker text NOT NULL);
CREATE TABLE public.ca_members(id text PRIMARY KEY,source_key text NOT NULL UNIQUE);
CREATE TABLE public.communities(id text PRIMARY KEY,name text NOT NULL);
CREATE TABLE public.community_ca_members(
 id text PRIMARY KEY,
 community_id text NOT NULL REFERENCES public.communities(id),
 ca_member_id text NOT NULL REFERENCES public.ca_members(id),
 UNIQUE(community_id,ca_member_id));
CREATE TABLE public.user_ca_identities(
 user_id text NOT NULL REFERENCES auth.users(id),
 community_id text NOT NULL,
 ca_member_id text NOT NULL,
 is_primary boolean NOT NULL,
 PRIMARY KEY(user_id,community_id,ca_member_id),
 CONSTRAINT user_ca_identities_community_id_ca_member_id_fkey
 FOREIGN KEY(community_id,ca_member_id)
 REFERENCES public.community_ca_members(community_id,ca_member_id)
 ON DELETE RESTRICT NOT DEFERRABLE);
CREATE TABLE public.stamp_collections(
 id text PRIMARY KEY,
 owner_user_id text NOT NULL REFERENCES auth.users(id),
 community_id text NOT NULL,
 stamp_ca_member_id text NOT NULL,
 notes text NOT NULL,
 FOREIGN KEY(community_id,stamp_ca_member_id)
 REFERENCES public.community_ca_members(community_id,ca_member_id));
CREATE TABLE public.stamp_collection_designs(
 id text PRIMARY KEY,
 collection_id text NOT NULL REFERENCES public.stamp_collections(id),
 design_marker text NOT NULL);
CREATE TABLE public.stamp_exchange_sessions(
 id text PRIMARY KEY,
 owner_user_id text NOT NULL REFERENCES auth.users(id),
 session_marker text NOT NULL);
CREATE TABLE public.sync_automation_state(
 id int PRIMARY KEY,
 enabled boolean NOT NULL,
 ca_master_sync_enabled boolean NOT NULL,
 last_ca_master_at timestamptz NOT NULL);
CREATE TABLE storage.objects(id text PRIMARY KEY,bucket_id text NOT NULL,name text NOT NULL);
INSERT INTO auth.users SELECT 'fake-user-'||i,'synthetic-'||i FROM generate_series(1,7) i;
INSERT INTO auth.identities SELECT 'fake-google-'||i,'fake-user-'||i FROM generate_series(1,7) i;
INSERT INTO public.profiles SELECT 'fake-user-'||i,'profile-'||i FROM generate_series(1,7) i;
INSERT INTO public.ca_members SELECT 'fake-ca-'||i,'synthetic-source-'||i FROM generate_series(1,200) i;
INSERT INTO public.communities SELECT 'fake-community-'||i,'synthetic-place-'||i FROM generate_series(1,155) i;
INSERT INTO public.community_ca_members
 SELECT 'fake-link-'||i,'fake-community-'||(((i-1)%155)+1),'fake-ca-'||i
 FROM generate_series(1,196) i;
INSERT INTO public.user_ca_identities
 SELECT 'fake-user-'||i,'fake-community-'||i,'fake-ca-'||i,true
 FROM generate_series(1,7) i;
INSERT INTO public.stamp_collections
 SELECT 'fake-medal-'||i,'fake-user-'||(((i-1)%7)+1),
 'fake-community-'||(((i-1)%7)+1),'fake-ca-'||(((i-1)%7)+1),
 'synthetic medal row '||i FROM generate_series(1,14) i;
INSERT INTO public.stamp_collection_designs
 SELECT 'fake-design-'||i,'fake-medal-'||i,'synthetic design '||i
 FROM generate_series(1,14) i;
INSERT INTO public.stamp_exchange_sessions
 SELECT 'fake-session-'||i,'fake-user-'||(((i-1)%7)+1),'synthetic session '||i
 FROM generate_series(1,20) i;
INSERT INTO public.sync_automation_state VALUES (1,true,false,'2099-01-01T00:00:00Z');
INSERT INTO storage.objects
 SELECT 'fake-asset-'||i,'synthetic-bucket','synthetic-icon-'||i
 FROM generate_series(1,418) i;
COMMIT;
