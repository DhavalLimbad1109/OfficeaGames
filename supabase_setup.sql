-- OfficeGames Supabase setup (admin-managed username/password auth)
-- Run this in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO postgres;

-- Drop legacy OTP/device-claim functions from the old auth flow.
DROP FUNCTION IF EXISTS public.is_player_name_available(TEXT);
DROP FUNCTION IF EXISTS public.is_device_available(TEXT);
DROP FUNCTION IF EXISTS public.claim_device_profile(TEXT, TEXT);
DROP TABLE IF EXISTS private.device_bindings CASCADE;

-- Core player profile table.
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS fingerprint TEXT;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_lower ON public.players (LOWER(name));
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_fingerprint ON public.players (fingerprint) WHERE fingerprint IS NOT NULL;

-- Login credentials for players.
CREATE TABLE IF NOT EXISTS public.player_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL UNIQUE REFERENCES public.players(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  must_reset_password BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_player_accounts_username_lower ON public.player_accounts (LOWER(username));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'player_accounts_username_format_chk'
      AND conrelid = 'public.player_accounts'::regclass
  ) THEN
    ALTER TABLE public.player_accounts
      ADD CONSTRAINT player_accounts_username_format_chk
      CHECK (username ~ '^[a-zA-Z0-9._-]{3,30}$');
  END IF;
END $$;

-- Admin credentials used for creating player accounts.
CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_accounts_username_lower ON public.admin_accounts (LOWER(username));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admin_accounts_username_format_chk'
      AND conrelid = 'public.admin_accounts'::regclass
  ) THEN
    ALTER TABLE public.admin_accounts
      ADD CONSTRAINT admin_accounts_username_format_chk
      CHECK (username ~ '^[a-zA-Z0-9._-]{3,30}$');
  END IF;
END $$;

-- Per-game score rows.
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
    WHERE conname = 'game_sessions_difficulty_chk'
      AND conrelid = 'public.game_sessions'::regclass
  ) THEN
    ALTER TABLE public.game_sessions
      ADD CONSTRAINT game_sessions_difficulty_chk
      CHECK (difficulty IN ('easy', 'medium', 'hard'));
  END IF;
END $$;

-- Session store for custom auth.
CREATE TABLE IF NOT EXISTS private.player_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  fp_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_player_sessions_player_fp
  ON private.player_sessions (player_id, fp_hash);

CREATE INDEX IF NOT EXISTS idx_player_sessions_token ON private.player_sessions (session_token);
CREATE INDEX IF NOT EXISTS idx_player_sessions_expires_at ON private.player_sessions (expires_at);

CREATE OR REPLACE FUNCTION private.resolve_player_session(_session_token UUID, _fp_hash TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_fp TEXT := NULLIF(TRIM(_fp_hash), '');
  v_player_id UUID;
BEGIN
  IF _session_token IS NULL THEN
    RAISE EXCEPTION 'missing_session';
  END IF;

  IF v_fp IS NULL THEN
    RAISE EXCEPTION 'missing_fingerprint';
  END IF;

  SELECT s.player_id
  INTO v_player_id
  FROM private.player_sessions s
  WHERE s.session_token = _session_token
    AND s.fp_hash = v_fp
    AND s.expires_at > NOW();

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'invalid_session';
  END IF;

  UPDATE private.player_sessions
  SET last_seen_at = NOW(),
      expires_at = NOW() + INTERVAL '30 days'
  WHERE session_token = _session_token;

  RETURN v_player_id;
END;
$$;

REVOKE ALL ON FUNCTION private.resolve_player_session(UUID, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.needs_admin_bootstrap()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.admin_accounts);
$$;

CREATE OR REPLACE FUNCTION public.bootstrap_admin(_username TEXT, _password TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT := LOWER(NULLIF(TRIM(_username), ''));
BEGIN
  IF v_username IS NULL THEN
    RAISE EXCEPTION 'invalid_username';
  END IF;

  IF v_username !~ '^[a-zA-Z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'invalid_username';
  END IF;

  IF COALESCE(LENGTH(_password), 0) < 6 THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_accounts) THEN
    RAISE EXCEPTION 'admin_already_initialized';
  END IF;

  INSERT INTO public.admin_accounts (username, password_hash, updated_at)
  VALUES (v_username, extensions.crypt(_password, extensions.gen_salt('bf', 10)), NOW());

  RETURN v_username;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_player(
  _admin_username TEXT,
  _admin_password TEXT,
  _player_name TEXT,
  _player_username TEXT,
  _temporary_password TEXT
)
RETURNS public.players
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_admin_username TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
  v_player_name TEXT := NULLIF(TRIM(_player_name), '');
  v_player_username TEXT := LOWER(NULLIF(TRIM(_player_username), ''));
  v_player public.players%ROWTYPE;
BEGIN
  IF v_admin_username IS NULL OR COALESCE(LENGTH(_admin_password), 0) = 0 THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  IF COALESCE(LENGTH(_temporary_password), 0) < 6 THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  IF v_player_name IS NULL OR v_player_name !~ '^[a-zA-Z0-9_ ]{2,20}$' THEN
    RAISE EXCEPTION 'invalid_player_name';
  END IF;

  IF v_player_username IS NULL OR v_player_username !~ '^[a-zA-Z0-9._-]{3,30}$' THEN
    RAISE EXCEPTION 'invalid_username';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.admin_accounts a
    WHERE LOWER(a.username) = v_admin_username
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('officegames-player-name:' || LOWER(v_player_name), 0));
  PERFORM pg_advisory_xact_lock(hashtextextended('officegames-player-username:' || v_player_username, 0));

  IF EXISTS (
    SELECT 1 FROM public.players p WHERE LOWER(p.name) = LOWER(v_player_name)
  ) THEN
    RAISE EXCEPTION 'player_name_taken';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.player_accounts pa WHERE LOWER(pa.username) = v_player_username
  ) THEN
    RAISE EXCEPTION 'player_username_taken';
  END IF;

  INSERT INTO public.players (name, updated_at)
  VALUES (v_player_name, NOW())
  RETURNING * INTO v_player;

  INSERT INTO public.player_accounts (
    player_id,
    username,
    password_hash,
    must_reset_password,
    updated_at
  )
  VALUES (
    v_player.id,
    v_player_username,
    extensions.crypt(_temporary_password, extensions.gen_salt('bf', 10)),
    TRUE,
    NOW()
  );

  RETURN v_player;
END;
$$;

CREATE OR REPLACE FUNCTION public.player_sign_in(
  _username TEXT,
  _password TEXT,
  _fp_hash TEXT
)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  session_token UUID,
  must_reset_password BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_username TEXT := LOWER(NULLIF(TRIM(_username), ''));
  v_fp TEXT := NULLIF(TRIM(_fp_hash), '');
  v_account RECORD;
  v_token UUID;
BEGIN
  IF v_username IS NULL OR COALESCE(LENGTH(_password), 0) = 0 THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  IF v_fp IS NULL THEN
    RAISE EXCEPTION 'missing_fingerprint';
  END IF;

  SELECT
    pa.player_id,
    p.name AS player_name,
    p.fingerprint,
    pa.must_reset_password
  INTO v_account
  FROM public.player_accounts pa
  JOIN public.players p ON p.id = pa.player_id
  WHERE LOWER(pa.username) = v_username
    AND pa.password_hash = extensions.crypt(_password, pa.password_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  IF v_account.fingerprint IS NOT NULL AND v_account.fingerprint <> v_fp THEN
    RAISE EXCEPTION 'account_locked_to_another_device';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.players p
    WHERE p.fingerprint = v_fp
      AND p.id <> v_account.player_id
  ) THEN
    RAISE EXCEPTION 'device_already_registered';
  END IF;

  UPDATE public.players
  SET fingerprint = COALESCE(fingerprint, v_fp),
      updated_at = NOW()
  WHERE id = v_account.player_id;

  v_token := gen_random_uuid();

  INSERT INTO private.player_sessions (
    session_token,
    player_id,
    fp_hash,
    expires_at,
    last_seen_at
  )
  VALUES (
    v_token,
    v_account.player_id,
    v_fp,
    NOW() + INTERVAL '30 days',
    NOW()
  )
  ON CONFLICT (player_id, fp_hash)
  DO UPDATE
  SET session_token = EXCLUDED.session_token,
      expires_at = EXCLUDED.expires_at,
      last_seen_at = EXCLUDED.last_seen_at;

  RETURN QUERY
  SELECT
    v_account.player_id,
    v_account.player_name,
    v_token,
    v_account.must_reset_password;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_player_session(
  _session_token UUID,
  _fp_hash TEXT
)
RETURNS TABLE (
  player_id UUID,
  player_name TEXT,
  must_reset_password BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_player_id UUID;
BEGIN
  v_player_id := private.resolve_player_session(_session_token, _fp_hash);

  RETURN QUERY
  SELECT p.id, p.name, pa.must_reset_password
  FROM public.players p
  JOIN public.player_accounts pa ON pa.player_id = p.id
  WHERE p.id = v_player_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.player_set_password(
  _session_token UUID,
  _fp_hash TEXT,
  _new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_player_id UUID;
BEGIN
  IF COALESCE(LENGTH(_new_password), 0) < 6 THEN
    RAISE EXCEPTION 'invalid_password';
  END IF;

  v_player_id := private.resolve_player_session(_session_token, _fp_hash);

  UPDATE public.player_accounts
  SET password_hash = extensions.crypt(_new_password, extensions.gen_salt('bf', 10)),
      must_reset_password = FALSE,
      updated_at = NOW()
  WHERE player_id = v_player_id;

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_player_weekly_score(
  _session_token UUID,
  _fp_hash TEXT,
  _week_start DATE
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_player_id UUID;
  v_score INTEGER;
BEGIN
  v_player_id := private.resolve_player_session(_session_token, _fp_hash);

  SELECT COALESCE(SUM(gs.score), 0)::INTEGER
  INTO v_score
  FROM public.game_sessions gs
  WHERE gs.player_id = v_player_id
    AND gs.week_start = _week_start;

  RETURN COALESCE(v_score, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_player_game_session(
  _session_token UUID,
  _fp_hash TEXT,
  _game_type TEXT,
  _difficulty TEXT,
  _score INTEGER,
  _correct_answers INTEGER,
  _wrong_answers INTEGER,
  _week_start DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  v_player_id UUID;
BEGIN
  IF NULLIF(TRIM(_game_type), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_game_type';
  END IF;

  IF _difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'invalid_difficulty';
  END IF;

  IF _week_start IS NULL THEN
    RAISE EXCEPTION 'invalid_week_start';
  END IF;

  v_player_id := private.resolve_player_session(_session_token, _fp_hash);

  INSERT INTO public.game_sessions (
    player_id,
    game_type,
    difficulty,
    score,
    correct_answers,
    wrong_answers,
    week_start
  )
  VALUES (
    v_player_id,
    TRIM(_game_type),
    _difficulty,
    COALESCE(_score, 0),
    COALESCE(_correct_answers, 0),
    COALESCE(_wrong_answers, 0),
    _week_start
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_weekly_leaderboard(_week_start DATE)
RETURNS TABLE (
  name TEXT,
  total_score BIGINT,
  games BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.name,
    SUM(gs.score)::BIGINT AS total_score,
    COUNT(*)::BIGINT AS games
  FROM public.game_sessions gs
  JOIN public.players p ON p.id = gs.player_id
  WHERE gs.week_start = _week_start
  GROUP BY p.id, p.name
  ORDER BY total_score DESC, games ASC, p.name ASC;
$$;

CREATE OR REPLACE FUNCTION public.player_sign_out(_session_token UUID, _fp_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  DELETE FROM private.player_sessions
  WHERE session_token = _session_token
    AND fp_hash = NULLIF(TRIM(_fp_hash), '');

  RETURN TRUE;
END;
$$;

-- RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE private.player_sessions ENABLE ROW LEVEL SECURITY;

-- Cleanup old policies from previous setup.
DROP POLICY IF EXISTS players_select_authenticated ON public.players;
DROP POLICY IF EXISTS players_insert_own ON public.players;
DROP POLICY IF EXISTS players_update_own ON public.players;
DROP POLICY IF EXISTS game_sessions_select_authenticated ON public.game_sessions;
DROP POLICY IF EXISTS game_sessions_insert_own ON public.game_sessions;
DROP POLICY IF EXISTS public_access ON public.players;
DROP POLICY IF EXISTS public_access ON public.game_sessions;

DROP POLICY IF EXISTS players_no_direct_access ON public.players;
DROP POLICY IF EXISTS player_accounts_no_direct_access ON public.player_accounts;
DROP POLICY IF EXISTS admin_accounts_no_direct_access ON public.admin_accounts;
DROP POLICY IF EXISTS game_sessions_no_direct_access ON public.game_sessions;
DROP POLICY IF EXISTS player_sessions_no_direct_access ON private.player_sessions;

CREATE POLICY players_no_direct_access
  ON public.players
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY player_accounts_no_direct_access
  ON public.player_accounts
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY admin_accounts_no_direct_access
  ON public.admin_accounts
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY game_sessions_no_direct_access
  ON public.game_sessions
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

CREATE POLICY player_sessions_no_direct_access
  ON private.player_sessions
  FOR ALL
  TO anon, authenticated
  USING (FALSE)
  WITH CHECK (FALSE);

-- No direct table access from API roles; API access goes through RPC only.
REVOKE ALL ON TABLE public.players FROM anon, authenticated;
REVOKE ALL ON TABLE public.player_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE public.admin_accounts FROM anon, authenticated;
REVOKE ALL ON TABLE public.game_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE private.player_sessions FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.needs_admin_bootstrap() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_admin(TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_player(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.player_sign_in(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_session(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.player_set_password(UUID, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_player_weekly_score(UUID, TEXT, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_player_game_session(UUID, TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER, DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_leaderboard(DATE) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.player_sign_out(UUID, TEXT) TO anon, authenticated;
