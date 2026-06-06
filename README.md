# OfficeGames

OfficeGames is a React + Vite mini-game app for quick 2-3 minute brain games in an office setting, with weekly competition through a shared Supabase leaderboard.

## Features

- Admin-managed player accounts (username + password)
- First-login password reset for newly created players
- One-player-per-device lock using a system-level fingerprint
- 6 active random game types with no immediate repeat:
  - Anagram Rush
  - Zip Puzzle
  - Emoji Decode
  - Number Sequence
  - Word Association
  - Word Search (tech-focused words)
- Difficulty progression from weekly score:
  - Easy: 0-50
  - Medium: 51-150
  - Hard: 151+
- Weekly leaderboard (resets Monday 10:00 AM IST)
- Speed-based scoring + hint penalties
- Ocean theme responsive UI

## Game Rules

- Each game round is timed by difficulty:
  - Easy: 120s
  - Medium: 150s
  - Hard: 180s
- Play-limit system exists for "2 games per 8 hours"
  - Controlled by env: `VITE_TESTING_NO_PLAY_LIMIT`
  - Set `true` for testing (unlimited), `false` for production behavior
- Hint usage deducts points from final score.

## Hint Penalties

Per hint used:

- Easy: -4
- Medium: -6
- Hard: -8

## Scoring

For each answer:

- Correct: `basePoints + speedBonus`
- Wrong: `-2`
- Speed bonus scales by remaining time and difficulty cap

Final score:

`max(0, sum(answer points) - total hint penalties)`

## Tech Stack

- React 19
- Vite 8
- Supabase (RPC + shared leaderboard data)
- localStorage (play history + local player/session cache)

## Project Structure

```text
src/
  components/
    games/                # Mini-game components
  data/gameData.js        # Question banks
  hooks/usePlayLimit.js   # 8-hour play gating logic
  lib/supabase.js         # Supabase client config
  utils/
    fingerprint.js
    gameUtils.js
    scoring.js
    weeklyReset.js
supabase_setup.sql        # SQL script for schema + RPC auth flow + RLS
```

## Setup (Local Development)

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create env file:

   ```bash
   copy .env.example .env
   ```

3. Add your Supabase values in `.env`:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (publishable key)

4. Run SQL setup in Supabase SQL Editor:

   - Open `supabase_setup.sql`
   - Execute all statements

5. In the app login screen:

   - Open **Admin Panel**
   - If no admin exists, create the first admin account
   - Use admin credentials to create player accounts with temporary passwords
   - Players login with username/password, then set a new password on first login

6. Start app:

   ```bash
   npm run dev
   ```

## Database Schema

Created by `supabase_setup.sql`:

- `players`
  - `id` UUID PK
  - `name` unique (case-insensitive index on `lower(name)`)
  - `fingerprint` unique when present
- `player_accounts`
  - `player_id` unique FK -> `players(id)`
  - `username` unique (case-insensitive)
  - `password_hash` + `must_reset_password`
- `admin_accounts`
  - admin login credentials for creating players
- `game_sessions`
  - `player_id` FK -> `players(id)`
  - per-game score + answer stats + `week_start`
- `private.player_sessions`
  - custom session token + fingerprint binding

Main RPC functions:

- `needs_admin_bootstrap()`
- `bootstrap_admin(_username text, _password text)`
- `admin_create_player(_admin_username text, _admin_password text, _player_name text, _player_username text, _temporary_password text)`
- `player_sign_in(_username text, _password text, _fp_hash text)`
- `get_player_session(_session_token uuid, _fp_hash text)`
- `player_set_password(_session_token uuid, _fp_hash text, _new_password text)`
- `get_player_weekly_score(_session_token uuid, _fp_hash text, _week_start date)`
- `record_player_game_session(_session_token uuid, _fp_hash text, ...)`
- `get_weekly_leaderboard(_week_start date)`

RLS is enabled and direct table access is denied for API roles; client access is through RPC functions only.

## Environment Variables

Use `.env` (Vite format):

```env
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_publishable_key_here
VITE_TESTING_NO_PLAY_LIMIT=false
```

## NPM Scripts

- `npm run dev` - start local dev server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - ESLint

## Production Checklist

1. Set `VITE_TESTING_NO_PLAY_LIMIT=false` in deployment env
2. Ensure Supabase env vars are valid in deployment environment
3. Ensure `supabase_setup.sql` has been executed on target database
4. Bootstrap first admin and create at least one player account
5. Verify one player can login, play, and appear on leaderboard

## Troubleshooting

### Login fails with invalid session

Clear local storage and login again:

- `og_player`
- `og_player_session`

### Leaderboard not updating

Check:

1. Supabase env values are loaded (`.env` and server restarted)
2. `players`, `player_accounts`, `admin_accounts`, `game_sessions`, `private.player_sessions` exist
3. `supabase_setup.sql` ran fully (RPC functions + grants + RLS)
4. Player logged in successfully and game writes use `record_player_game_session`
