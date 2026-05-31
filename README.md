# OfficeGames

OfficeGames is a React + Vite mini-game app for quick 2-3 minute brain games in an office setting, with weekly competition through a shared Supabase leaderboard.

## Features

- One-player-per-device registration using a system-level fingerprint
- Email OTP auth (Supabase Auth) with in-app OTP verification screen
- Unique player name enforcement (case-insensitive)
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
- Supabase (Auth + shared leaderboard data)
- localStorage (play history + local player cache)

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
supabase_setup.sql        # SQL script for schema + RLS
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

5. Configure Supabase Auth:

   - Enable Email provider in **Authentication -> Providers**
   - In **Authentication -> URL Configuration**, set your Site URL to your app domain
   - In **Authentication -> Email Templates**:
     - **Magic Link** template should include `{{ .Token }}`
     - **Confirm signup** template should include `{{ .Token }}`
   - Keep email auth enabled for OTP sign-in/sign-up

6. Start app:

   ```bash
   npm run dev
   ```

## Database Schema

Created by `supabase_setup.sql`:

- `players`
  - `id` UUID PK
  - `auth_user_id` UUID UNIQUE -> `auth.users(id)`
  - `name` unique (case-insensitive index on `lower(name)`)
- `game_sessions`
  - `player_id` FK -> `players(id)`
  - per-game score + answer stats + `week_start`
- `private.device_bindings`
  - `auth_user_id` unique -> `auth.users(id)`
  - `fp_hash` unique (device fingerprint hash)

Main RPC functions:

- `is_player_name_available(_name text)`
- `is_device_available(_fp_hash text)`
- `claim_device_profile(_fp_hash text, _name text)`

RLS is enabled on public tables and writes are scoped to authenticated users.

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
4. Ensure Supabase Auth email provider is enabled and both **Magic Link** + **Confirm signup** templates include `{{ .Token }}`
5. Verify leaderboard writes by completing one game end-to-end

## Troubleshooting

### Leaderboard not updating

Check:

1. Supabase env values are loaded (`.env` and server restarted)
2. `players`, `game_sessions`, and `private.device_bindings` exist
3. RLS policies were created from `supabase_setup.sql`
4. User is verified and signed in, then profile is claimed via `claim_device_profile`
