-- OfficeGames Supabase Setup
-- Run this in your Supabase SQL Editor (https://app.supabase.com → SQL Editor)

-- Players table (one row per registered computer/phone)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT players_fingerprint_unique UNIQUE (fingerprint)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_lower ON players (LOWER(name));

-- Game sessions table (one row per completed game)
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  correct_answers INTEGER NOT NULL DEFAULT 0,
  wrong_answers INTEGER NOT NULL DEFAULT 0,
  played_at TIMESTAMPTZ DEFAULT NOW(),
  week_start DATE NOT NULL
);

-- Index for fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_game_sessions_week ON game_sessions(week_start, player_id);
CREATE INDEX IF NOT EXISTS idx_players_fingerprint ON players(fingerprint);

-- Row Level Security (allow public access since no auth)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_access ON players;
DROP POLICY IF EXISTS public_access ON game_sessions;

CREATE POLICY public_access ON players FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY public_access ON game_sessions FOR ALL TO anon USING (true) WITH CHECK (true);
