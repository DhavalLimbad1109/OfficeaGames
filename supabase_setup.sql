-- OfficeGames Supabase Setup (email auth + device lock)
-- Run this in your Supabase SQL Editor (https://app.supabase.com -> SQL Editor)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Private schema for non-public device lock data
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres;

-- Public player profile table (safe leaderboard fields only)
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Legacy compatibility (old versions used players.fingerprint)
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_lower ON public.players (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_auth_user_id ON public.players (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_players_fingerprint ON public.players (fingerprint) WHERE fingerprint IS NOT NULL;

-- Device lock table is private (not exposed through public APIs)
CREATE TABLE IF NOT EXISTS private.device_bindings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  fp_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per game score rows
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  week_start DATE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_game_sessions_week ON public.game_sessions (week_start, player_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_player_id ON public.game_sessions (player_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'players_name_format_chk'
      AND conrelid = 'public.players'::regclass
  ) THEN
    ALTER TABLE public.players
      ADD CONSTRAINT players_name_format_chk
      CHECK (name ~ '^[a-zA-Z0-9_ ]{2,20}$');
  END IF;
END $$;

-- Helper: pre-check player-name availability before sign-up
CREATE OR REPLACE FUNCTION public.is_player_name_available(_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NULLIF(TRIM(_name), '') IS NULL THEN FALSE
    WHEN TRIM(_name) !~ '^[a-zA-Z0-9_ ]{2,20}$' THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1 FROM public.players p WHERE LOWER(p.name) = LOWER(TRIM(_name))
    )
  END;
$$;

-- Helper: pre-check whether this device hash is already bound
CREATE OR REPLACE FUNCTION public.is_device_available(_fp_hash TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = private
AS $$
  SELECT CASE
    WHEN NULLIF(TRIM(_fp_hash), '') IS NULL THEN FALSE
    ELSE NOT EXISTS (
      SELECT 1 FROM private.device_bindings d WHERE d.fp_hash = TRIM(_fp_hash)
    )
  END;
$$;

-- Main RPC used after auth sign-in/sign-up confirmation
CREATE OR REPLACE FUNCTION public.claim_device_profile(_fp_hash TEXT, _name TEXT DEFAULT NULL)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_fp TEXT := NULLIF(TRIM(_fp_hash), '');
  v_name TEXT := NULLIF(TRIM(_name), '');
  v_existing_user UUID;
  v_existing_fp TEXT;
  v_player public.players%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF v_fp IS NULL THEN
    RAISE EXCEPTION 'missing_fingerprint';
  END IF;

  -- Serialize by user + fingerprint to avoid race conditions during first claim.
  PERFORM pg_advisory_xact_lock(hashtextextended('officegames-user:' || v_uid::TEXT, 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('officegames-fp:' || v_fp, 0));

  SELECT d.auth_user_id
  INTO v_existing_user
  FROM private.device_bindings d
  WHERE d.fp_hash = v_fp;

  IF v_existing_user IS NOT NULL AND v_existing_user <> v_uid THEN
    RAISE EXCEPTION 'device_already_registered';
  END IF;

  SELECT d.fp_hash
  INTO v_existing_fp
  FROM private.device_bindings d
  WHERE d.auth_user_id = v_uid;

  IF v_existing_fp IS NOT NULL AND v_existing_fp <> v_fp THEN
    RAISE EXCEPTION 'account_locked_to_another_device';
  END IF;

  INSERT INTO private.device_bindings (auth_user_id, fp_hash, last_seen_at)
  VALUES (v_uid, v_fp, NOW())
  ON CONFLICT (auth_user_id) DO UPDATE
  SET fp_hash = EXCLUDED.fp_hash,
      last_seen_at = NOW();

  SELECT p.*
  INTO v_player
  FROM public.players p
  WHERE p.auth_user_id = v_uid;

  IF FOUND THEN
    UPDATE public.players
    SET updated_at = NOW()
    WHERE id = v_player.id
    RETURNING * INTO v_player;
    RETURN v_player;
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'missing_player_name';
  END IF;

  IF v_name !~ '^[a-zA-Z0-9_ ]{2,20}$' THEN
    RAISE EXCEPTION 'invalid_player_name';
  END IF;

  INSERT INTO public.players (auth_user_id, name)
  VALUES (v_uid, v_name)
  RETURNING * INTO v_player;

  RETURN v_player;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'player_name_taken';
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_player_name_available(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_device_available(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_device_profile(TEXT, TEXT) TO authenticated;

-- Row Level Security
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.device_bindings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_access ON public.players;
DROP POLICY IF EXISTS public_access ON public.game_sessions;
DROP POLICY IF EXISTS players_select_authenticated ON public.players;
DROP POLICY IF EXISTS players_insert_own ON public.players;
DROP POLICY IF EXISTS players_update_own ON public.players;
DROP POLICY IF EXISTS game_sessions_select_authenticated ON public.game_sessions;
DROP POLICY IF EXISTS game_sessions_insert_own ON public.game_sessions;

CREATE POLICY players_select_authenticated
  ON public.players
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY players_insert_own
  ON public.players
  FOR INSERT
  TO authenticated
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY players_update_own
  ON public.players
  FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY game_sessions_select_authenticated
  ON public.game_sessions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY game_sessions_insert_own
  ON public.game_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.players p
      WHERE p.id = player_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- Keep private bindings unreadable from client roles
DROP POLICY IF EXISTS deny_all_device_bindings ON private.device_bindings;
CREATE POLICY deny_all_device_bindings
  ON private.device_bindings
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

GRANT SELECT ON public.players TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon, authenticated;
GRANT SELECT, INSERT ON public.game_sessions TO authenticated;
REVOKE UPDATE, DELETE ON public.game_sessions FROM anon, authenticated;
REVOKE ALL ON private.device_bindings FROM anon, authenticated;
