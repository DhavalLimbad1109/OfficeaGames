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
#variable_conflict use_column
DECLARE
  v_username TEXT := LOWER(NULLIF(TRIM(_username), ''));
  v_fp TEXT := NULLIF(TRIM(_fp_hash), '');
  v_pid UUID;
  v_pname TEXT;
  v_must_reset BOOLEAN;
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
    p.name,
    pa.must_reset_password
  INTO v_pid, v_pname, v_must_reset
  FROM public.player_accounts pa
  JOIN public.players p ON p.id = pa.player_id
  WHERE LOWER(pa.username) = v_username
    AND pa.password_hash = extensions.crypt(_password, pa.password_hash);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

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
    v_pid,
    v_fp,
    NOW() + INTERVAL '30 days',
    NOW()
  )
  ON CONFLICT (player_id, fp_hash)
  DO UPDATE
  SET session_token = EXCLUDED.session_token,
      expires_at = EXCLUDED.expires_at,
      last_seen_at = EXCLUDED.last_seen_at;

  player_id := v_pid;
  player_name := v_pname;
  session_token := v_token;
  must_reset_password := v_must_reset;
  RETURN NEXT;
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

-- ══════════════════════════════════════════════════════════════════
-- Extended features: questions, daily challenges, stats, achievements
-- ══════════════════════════════════════════════════════════════════

-- Game questions table
CREATE TABLE IF NOT EXISTS public.game_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  question_data JSONB NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  times_shown INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_game_questions_type_diff ON public.game_questions (game_type, difficulty);

-- Daily challenges table
CREATE TABLE IF NOT EXISTS public.daily_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL UNIQUE,
  game_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  questions JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daily scores table
CREATE TABLE IF NOT EXISTS public.daily_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_date DATE NOT NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (challenge_date, player_id)
);

-- Achievements table
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  threshold INTEGER NOT NULL DEFAULT 1
);

-- Player achievements table
CREATE TABLE IF NOT EXISTS public.player_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, achievement_id)
);

-- RLS for new tables
ALTER TABLE public.game_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS game_questions_no_direct ON public.game_questions;
CREATE POLICY game_questions_no_direct ON public.game_questions FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS daily_challenges_no_direct ON public.daily_challenges;
CREATE POLICY daily_challenges_no_direct ON public.daily_challenges FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS daily_scores_no_direct ON public.daily_scores;
CREATE POLICY daily_scores_no_direct ON public.daily_scores FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS achievements_no_direct ON public.achievements;
CREATE POLICY achievements_no_direct ON public.achievements FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);
DROP POLICY IF EXISTS player_achievements_no_direct ON public.player_achievements;
CREATE POLICY player_achievements_no_direct ON public.player_achievements FOR ALL TO anon, authenticated USING (FALSE) WITH CHECK (FALSE);

REVOKE ALL ON TABLE public.game_questions FROM anon, authenticated;
REVOKE ALL ON TABLE public.daily_challenges FROM anon, authenticated;
REVOKE ALL ON TABLE public.daily_scores FROM anon, authenticated;
REVOKE ALL ON TABLE public.achievements FROM anon, authenticated;
REVOKE ALL ON TABLE public.player_achievements FROM anon, authenticated;

-- Seed achievements
INSERT INTO public.achievements (id, title, description, icon, category, threshold) VALUES
  ('first_win', 'First Victory', 'Win your first game', '🏆', 'general', 1),
  ('games_5', 'Getting Started', 'Play 5 games', '🎮', 'general', 5),
  ('games_25', 'Regular Player', 'Play 25 games', '🎯', 'general', 25),
  ('games_50', 'Dedicated Gamer', 'Play 50 games', '⭐', 'general', 50),
  ('games_100', 'Century Club', 'Play 100 games', '💯', 'general', 100),
  ('score_50', 'Half Century', 'Score 50+ in a single game', '🔥', 'score', 50),
  ('score_100', 'Triple Digits', 'Score 100+ in a single game', '💫', 'score', 100),
  ('perfect_score', 'Perfectionist', 'Get 100% accuracy in a game', '💎', 'score', 1),
  ('streak_3', 'On a Roll', 'Play 3 days in a row', '🔥', 'streak', 3),
  ('streak_7', 'Week Warrior', 'Play 7 days in a row', '⚡', 'streak', 7),
  ('streak_14', 'Fortnight Fighter', 'Play 14 days in a row', '🌟', 'streak', 14),
  ('streak_30', 'Monthly Master', 'Play 30 days in a row', '👑', 'streak', 30),
  ('speed_demon', 'Speed Demon', 'Answer 5 questions correctly in under 10 seconds each', '⚡', 'special', 5),
  ('all_games', 'Jack of All Trades', 'Play every game type at least once', '🃏', 'special', 1),
  ('medium_unlock', 'Level Up', 'Unlock medium difficulty', '🔼', 'general', 1),
  ('hard_unlock', 'Elite Player', 'Unlock hard difficulty', '🔶', 'general', 1),
  ('leaderboard_top3', 'Podium Finish', 'Finish in the top 3 of the weekly leaderboard', '🏅', 'special', 1),
  ('daily_first', 'Daily Challenger', 'Complete your first daily challenge', '📅', 'daily', 1),
  ('daily_10', 'Daily Devotee', 'Complete 10 daily challenges', '🗓️', 'daily', 10)
ON CONFLICT (id) DO NOTHING;

-- ── Extended RPC functions ──

CREATE OR REPLACE FUNCTION public.admin_add_question(_admin_username text, _admin_password text, _game_type text, _difficulty text, _question_data jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
  v_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_accounts a
    WHERE LOWER(a.username) = v_admin
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  IF _difficulty NOT IN ('easy', 'medium', 'hard') THEN
    RAISE EXCEPTION 'invalid_difficulty';
  END IF;

  INSERT INTO public.game_questions (game_type, difficulty, question_data)
  VALUES (TRIM(_game_type), _difficulty, _question_data)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_delete_question(_admin_username text, _admin_password text, _question_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_accounts a
    WHERE LOWER(a.username) = v_admin
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  DELETE FROM public.game_questions WHERE id = _question_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'question_not_found';
  END IF;

  RETURN TRUE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_get_question_stats(_admin_username text, _admin_password text)
 RETURNS TABLE(game_type text, difficulty text, total_count bigint, active_count bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_admin TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_accounts a
    WHERE LOWER(a.username) = v_admin
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  RETURN QUERY
  SELECT gq.game_type, gq.difficulty, COUNT(*)::BIGINT, COUNT(*) FILTER (WHERE gq.active)::BIGINT
  FROM game_questions gq
  GROUP BY gq.game_type, gq.difficulty
  ORDER BY gq.game_type, gq.difficulty;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_get_stats(_admin_username text, _admin_password text)
 RETURNS TABLE(total_players bigint, total_games_played bigint, games_today bigint, games_this_week bigint, total_questions bigint, active_questions bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_admin TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_accounts a
    WHERE LOWER(a.username) = v_admin
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM players)::BIGINT,
    (SELECT COUNT(*) FROM game_sessions)::BIGINT,
    (SELECT COUNT(*) FROM game_sessions WHERE played_at::date = CURRENT_DATE)::BIGINT,
    (SELECT COUNT(*) FROM game_sessions WHERE played_at > NOW() - INTERVAL '7 days')::BIGINT,
    (SELECT COUNT(*) FROM game_questions)::BIGINT,
    (SELECT COUNT(*) FROM game_questions WHERE active = TRUE)::BIGINT;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_get_top_players(_admin_username text, _admin_password text, _limit integer DEFAULT 10)
 RETURNS TABLE(player_name text, total_games bigint, total_score bigint, last_played timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_admin TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM admin_accounts a
    WHERE LOWER(a.username) = v_admin
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  RETURN QUERY
  SELECT p.name, COUNT(gs.id)::BIGINT, COALESCE(SUM(gs.score), 0)::BIGINT, MAX(gs.played_at)
  FROM players p
  LEFT JOIN game_sessions gs ON gs.player_id = p.id
  GROUP BY p.id, p.name
  ORDER BY COALESCE(SUM(gs.score), 0) DESC, COUNT(gs.id) DESC
  LIMIT _limit;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_list_questions(_admin_username text, _admin_password text, _game_type text DEFAULT NULL::text, _difficulty text DEFAULT NULL::text)
 RETURNS TABLE(id uuid, game_type text, difficulty text, question_data jsonb, active boolean, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_admin TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_accounts a
    WHERE LOWER(a.username) = v_admin
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  RETURN QUERY
  SELECT gq.id, gq.game_type, gq.difficulty, gq.question_data, gq.active, gq.created_at
  FROM public.game_questions gq
  WHERE (_game_type IS NULL OR gq.game_type = _game_type)
    AND (_difficulty IS NULL OR gq.difficulty = _difficulty)
  ORDER BY gq.game_type, gq.difficulty, gq.created_at DESC;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.admin_toggle_question(_admin_username text, _admin_password text, _question_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_admin TEXT := LOWER(NULLIF(TRIM(_admin_username), ''));
  v_active BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_accounts a
    WHERE LOWER(a.username) = v_admin
      AND a.password_hash = extensions.crypt(_admin_password, a.password_hash)
  ) THEN
    RAISE EXCEPTION 'invalid_admin_credentials';
  END IF;

  UPDATE public.game_questions
  SET active = NOT active, updated_at = NOW()
  WHERE id = _question_id
  RETURNING active INTO v_active;

  IF v_active IS NULL THEN
    RAISE EXCEPTION 'question_not_found';
  END IF;

  RETURN v_active;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.award_achievement(_session_token uuid, _fp_hash text, _achievement_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_pid UUID;
BEGIN
  v_pid := private.resolve_player_session(_session_token, _fp_hash);
  INSERT INTO player_achievements (player_id, achievement_id)
  VALUES (v_pid, _achievement_id)
  ON CONFLICT (player_id, achievement_id) DO NOTHING;
  RETURN TRUE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_and_award_achievements(
  _session_token UUID,
  _fp_hash TEXT,
  _game_score INTEGER DEFAULT 0,
  _correct INTEGER DEFAULT 0,
  _wrong INTEGER DEFAULT 0,
  _difficulty TEXT DEFAULT 'easy',
  _time_remaining_pct NUMERIC DEFAULT 0
)
RETURNS TABLE(achievement_id TEXT, title TEXT, icon TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
#variable_conflict use_column
DECLARE
  v_pid UUID;
  v_total_games BIGINT;
  v_distinct_types BIGINT;
  v_daily_count BIGINT;
  v_current_streak INTEGER := 0;
  v_max_streak INTEGER := 0;
  v_prev_date DATE := NULL;
  v_accuracy NUMERIC := 0;
  r RECORD;
BEGIN
  v_pid := private.resolve_player_session(_session_token, _fp_hash);

  SELECT COUNT(*) INTO v_total_games FROM game_sessions WHERE player_id = v_pid;
  SELECT COUNT(DISTINCT game_type) INTO v_distinct_types FROM game_sessions WHERE player_id = v_pid;
  SELECT COUNT(*) INTO v_daily_count FROM daily_scores WHERE player_id = v_pid;

  IF (_correct + _wrong) > 0 THEN
    v_accuracy := _correct::NUMERIC / (_correct + _wrong) * 100;
  END IF;

  FOR r IN
    SELECT DISTINCT played_at::date AS play_date
    FROM game_sessions WHERE player_id = v_pid ORDER BY play_date DESC
  LOOP
    IF v_prev_date IS NULL OR v_prev_date - r.play_date = 1 THEN
      v_current_streak := v_current_streak + 1;
    ELSE
      IF v_prev_date IS NOT NULL THEN
        v_max_streak := GREATEST(v_max_streak, v_current_streak);
        v_current_streak := 1;
      END IF;
    END IF;
    v_prev_date := r.play_date;
  END LOOP;
  v_max_streak := GREATEST(v_max_streak, v_current_streak);
  IF v_prev_date IS NOT NULL AND (CURRENT_DATE - v_prev_date) > 1 THEN
    v_current_streak := 0;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _new_achievements (
    achievement_id TEXT, title TEXT, icon TEXT
  ) ON COMMIT DROP;
  DELETE FROM _new_achievements;

  -- Milestone achievements
  IF v_total_games >= 1 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'first_win') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'first_win', a.title, a.icon FROM achievements a WHERE a.id = 'first_win'; END IF;
  END IF;
  IF v_total_games >= 5 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'games_5') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'games_5', a.title, a.icon FROM achievements a WHERE a.id = 'games_5'; END IF;
  END IF;
  IF v_total_games >= 25 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'games_25') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'games_25', a.title, a.icon FROM achievements a WHERE a.id = 'games_25'; END IF;
  END IF;
  IF v_total_games >= 50 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'games_50') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'games_50', a.title, a.icon FROM achievements a WHERE a.id = 'games_50'; END IF;
  END IF;
  IF v_total_games >= 100 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'games_100') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'games_100', a.title, a.icon FROM achievements a WHERE a.id = 'games_100'; END IF;
  END IF;

  -- Score achievements
  IF _game_score >= 50 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'score_50') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'score_50', a.title, a.icon FROM achievements a WHERE a.id = 'score_50'; END IF;
  END IF;
  IF _game_score >= 100 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'score_100') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'score_100', a.title, a.icon FROM achievements a WHERE a.id = 'score_100'; END IF;
  END IF;

  -- Skill achievements
  IF v_accuracy >= 100 AND (_correct + _wrong) >= 5 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'perfect_score') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'perfect_score', a.title, a.icon FROM achievements a WHERE a.id = 'perfect_score'; END IF;
  END IF;
  IF _correct >= 8 AND _time_remaining_pct >= 50 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'speed_demon') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'speed_demon', a.title, a.icon FROM achievements a WHERE a.id = 'speed_demon'; END IF;
  END IF;

  -- Difficulty achievements
  IF _difficulty = 'medium' THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'medium_unlock') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'medium_unlock', a.title, a.icon FROM achievements a WHERE a.id = 'medium_unlock'; END IF;
  END IF;
  IF _difficulty = 'hard' THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'hard_unlock') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'hard_unlock', a.title, a.icon FROM achievements a WHERE a.id = 'hard_unlock'; END IF;
  END IF;

  -- Exploration
  IF v_distinct_types >= 6 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'all_games') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'all_games', a.title, a.icon FROM achievements a WHERE a.id = 'all_games'; END IF;
  END IF;

  -- Streak achievements
  IF v_current_streak >= 3 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'streak_3') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'streak_3', a.title, a.icon FROM achievements a WHERE a.id = 'streak_3'; END IF;
  END IF;
  IF v_current_streak >= 7 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'streak_7') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'streak_7', a.title, a.icon FROM achievements a WHERE a.id = 'streak_7'; END IF;
  END IF;
  IF v_current_streak >= 14 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'streak_14') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'streak_14', a.title, a.icon FROM achievements a WHERE a.id = 'streak_14'; END IF;
  END IF;
  IF v_current_streak >= 30 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'streak_30') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'streak_30', a.title, a.icon FROM achievements a WHERE a.id = 'streak_30'; END IF;
  END IF;

  -- Daily achievements
  IF v_daily_count >= 1 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'daily_first') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'daily_first', a.title, a.icon FROM achievements a WHERE a.id = 'daily_first'; END IF;
  END IF;
  IF v_daily_count >= 10 THEN
    INSERT INTO player_achievements (player_id, achievement_id) VALUES (v_pid, 'daily_10') ON CONFLICT DO NOTHING;
    IF FOUND THEN INSERT INTO _new_achievements SELECT 'daily_10', a.title, a.icon FROM achievements a WHERE a.id = 'daily_10'; END IF;
  END IF;

  RETURN QUERY SELECT * FROM _new_achievements;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_player_is_admin(_session_token uuid, _fp_hash text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_player_id UUID;
  v_username TEXT;
BEGIN
  v_player_id := private.resolve_player_session(_session_token, _fp_hash);

  SELECT pa.username INTO v_username
  FROM public.player_accounts pa
  WHERE pa.player_id = v_player_id;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_accounts a
    WHERE LOWER(a.username) = LOWER(v_username)
  );
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_daily_challenge(_today date DEFAULT CURRENT_DATE)
 RETURNS TABLE(challenge_date date, game_type text, difficulty text, questions jsonb, already_played boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_challenge RECORD;
  v_game_types TEXT[] := ARRAY['anagram','emojidecode','numbersequence','wordassociation','truefalse','oddoneout','trivia'];
  v_difficulties TEXT[] := ARRAY['easy','medium','hard'];
  v_gt TEXT;
  v_diff TEXT;
  v_qs JSONB;
BEGIN
  SELECT * INTO v_challenge FROM daily_challenges dc WHERE dc.challenge_date = _today;

  IF NOT FOUND THEN
    v_gt := v_game_types[1 + (EXTRACT(DOY FROM _today)::INT % array_length(v_game_types, 1))];
    v_diff := v_difficulties[1 + (EXTRACT(DOY FROM _today)::INT % array_length(v_difficulties, 1))];

    INSERT INTO daily_challenges (challenge_date, game_type, difficulty, questions)
    VALUES (_today, v_gt, v_diff, '[]'::jsonb)
    ON CONFLICT (challenge_date) DO NOTHING
    RETURNING * INTO v_challenge;

    IF NOT FOUND THEN
      SELECT * INTO v_challenge FROM daily_challenges dc WHERE dc.challenge_date = _today;
    END IF;
  END IF;

  -- Fetch fresh random questions each time (different per player)
  SELECT jsonb_agg(gq.question_data ORDER BY random()) INTO v_qs
  FROM (
    SELECT question_data FROM game_questions
    WHERE game_type = v_challenge.game_type AND difficulty = v_challenge.difficulty AND active = TRUE
    ORDER BY random() LIMIT 10
  ) gq;

  IF v_qs IS NULL OR jsonb_array_length(v_qs) = 0 THEN
    SELECT jsonb_agg(gq.question_data ORDER BY random()) INTO v_qs
    FROM (
      SELECT question_data FROM game_questions
      WHERE game_type = v_challenge.game_type AND active = TRUE
      ORDER BY random() LIMIT 10
    ) gq;
  END IF;

  RETURN QUERY
  SELECT v_challenge.challenge_date, v_challenge.game_type, v_challenge.difficulty, COALESCE(v_qs, '[]'::jsonb), FALSE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_daily_leaderboard(_challenge_date date DEFAULT CURRENT_DATE)
 RETURNS TABLE(name text, score integer, correct_answers integer, wrong_answers integer)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.name, ds.score, ds.correct_answers, ds.wrong_answers
  FROM daily_scores ds
  JOIN players p ON p.id = ds.player_id
  WHERE ds.challenge_date = _challenge_date
  ORDER BY ds.score DESC, ds.correct_answers DESC
  LIMIT 50;
$function$
;
CREATE OR REPLACE FUNCTION public.get_game_questions(_game_type text, _difficulty text, _count integer DEFAULT 10)
 RETURNS SETOF jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT question_data
  FROM public.game_questions
  WHERE game_type = _game_type
    AND difficulty = _difficulty
    AND active = TRUE
  ORDER BY random()
  LIMIT _count;
$function$
;
CREATE OR REPLACE FUNCTION public.get_player_achievements(_session_token uuid, _fp_hash text)
 RETURNS TABLE(achievement_id text, title text, description text, icon text, category text, earned_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
#variable_conflict use_column
DECLARE
  v_pid UUID;
BEGIN
  v_pid := private.resolve_player_session(_session_token, _fp_hash);
  RETURN QUERY
  SELECT a.id, a.title, a.description, a.icon, a.category, pa.earned_at
  FROM achievements a
  LEFT JOIN player_achievements pa ON pa.achievement_id = a.id AND pa.player_id = v_pid
  ORDER BY pa.earned_at IS NOT NULL DESC, a.category, a.threshold;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.get_player_stats(_session_token uuid, _fp_hash text)
 RETURNS TABLE(total_games bigint, total_correct bigint, total_wrong bigint, accuracy numeric, best_score integer, current_streak integer, longest_streak integer, favorite_game text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
#variable_conflict use_column
DECLARE
  v_pid UUID;
  v_streak INTEGER := 0;
  v_max_streak INTEGER := 0;
  v_prev_date DATE := NULL;
  r RECORD;
BEGIN
  v_pid := private.resolve_player_session(_session_token, _fp_hash);

  -- Calculate streaks from daily play dates
  FOR r IN
    SELECT DISTINCT played_at::date AS play_date
    FROM game_sessions WHERE player_id = v_pid
    ORDER BY play_date DESC
  LOOP
    IF v_prev_date IS NULL OR v_prev_date - r.play_date = 1 THEN
      v_streak := v_streak + 1;
    ELSE
      IF v_prev_date IS NOT NULL THEN
        v_max_streak := GREATEST(v_max_streak, v_streak);
        v_streak := 1;
      END IF;
    END IF;
    v_prev_date := r.play_date;
  END LOOP;
  v_max_streak := GREATEST(v_max_streak, v_streak);

  -- Check if current streak is still active (played today or yesterday)
  IF v_prev_date IS NULL OR (CURRENT_DATE - v_prev_date > 1 AND v_streak = v_max_streak) THEN
    v_streak := 0;
  END IF;

  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT,
    COALESCE(SUM(gs.correct_answers), 0)::BIGINT,
    COALESCE(SUM(gs.wrong_answers), 0)::BIGINT,
    CASE WHEN SUM(gs.correct_answers) + SUM(gs.wrong_answers) > 0
      THEN ROUND(SUM(gs.correct_answers)::NUMERIC / (SUM(gs.correct_answers) + SUM(gs.wrong_answers)) * 100, 1)
      ELSE 0 END,
    COALESCE(MAX(gs.score), 0)::INTEGER,
    v_streak,
    v_max_streak,
    (SELECT gs2.game_type FROM game_sessions gs2 WHERE gs2.player_id = v_pid
     GROUP BY gs2.game_type ORDER BY COUNT(*) DESC LIMIT 1)
  FROM game_sessions gs
  WHERE gs.player_id = v_pid;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.has_played_daily(_session_token uuid, _fp_hash text, _challenge_date date DEFAULT CURRENT_DATE)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_pid UUID;
BEGIN
  v_pid := private.resolve_player_session(_session_token, _fp_hash);
  RETURN EXISTS (SELECT 1 FROM daily_scores WHERE challenge_date = _challenge_date AND player_id = v_pid);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.record_daily_score(_session_token uuid, _fp_hash text, _challenge_date date, _score integer, _correct integer, _wrong integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  v_pid UUID;
BEGIN
  v_pid := private.resolve_player_session(_session_token, _fp_hash);

  INSERT INTO daily_scores (challenge_date, player_id, score, correct_answers, wrong_answers)
  VALUES (_challenge_date, v_pid, _score, _correct, _wrong)
  ON CONFLICT (challenge_date, player_id) DO NOTHING;

  RETURN TRUE;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.update_question_stats(_game_type text, _question_data jsonb, _correct boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE game_questions
  SET times_shown = times_shown + 1,
      times_correct = times_correct + CASE WHEN _correct THEN 1 ELSE 0 END
  WHERE game_type = _game_type
    AND question_data = _question_data
    AND active = TRUE;
END;
$function$
;
