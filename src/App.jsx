import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase.js'
import { generateFingerprint } from './utils/fingerprint.js'
import { getDifficultyFromScore, calculateFinalScore, DIFFICULTY_CONFIG } from './utils/scoring.js'
import { pickRandomGame, pickQuestions } from './utils/gameUtils.js'
import { getPlayStatus, recordPlay, getLastGameType, setLastGameType } from './hooks/usePlayLimit.js'
import { getWeekStart } from './utils/weeklyReset.js'
import { ALL_QUESTIONS } from './data/gameData.js'
import Registration from './components/Registration.jsx'
import GameHub from './components/GameHub.jsx'
import GameScreen from './components/GameScreen.jsx'
import GameResult from './components/GameResult.jsx'
import Leaderboard from './components/Leaderboard.jsx'

const PLAYER_KEY = 'og_player'
const PLAYER_SESSION_KEY = 'og_player_session'

function normalizePlayerName(name) {
  const cleaned = (name || '').trim().replace(/\s+/g, ' ')
  return cleaned.slice(0, 20)
}

function normalizeUsername(value) {
  return (value || '').trim().toLowerCase()
}

function extractRpcRow(data) {
  if (Array.isArray(data)) return data[0] || null
  return data || null
}

function formatAuthError(error) {
  const msg = error?.message || ''
  if (msg.includes('invalid_credentials')) return 'Invalid username or password.'
  if (msg.includes('invalid_admin_credentials')) return 'Invalid admin credentials.'
  if (msg.includes('invalid_session')) return 'Session expired. Please login again.'
  if (msg.includes('missing_session')) return 'Session missing. Please login again.'
  if (msg.includes('missing_fingerprint')) return 'Could not verify this device. Please retry.'
  if (msg.includes('device_already_registered')) return 'This device is already linked to another account.'
  if (msg.includes('account_locked_to_another_device')) return 'This account is locked to another device.'
  if (msg.includes('player_name_taken')) return 'Player name is already taken.'
  if (msg.includes('player_username_taken')) return 'Player username is already taken.'
  if (msg.includes('invalid_player_name')) return 'Player name must be 2-20 chars (letters, numbers, spaces, underscore).'
  if (msg.includes('invalid_username')) return 'Username must be 3-30 chars (letters, numbers, dot, underscore, dash).'
  if (msg.includes('invalid_password')) return 'Password must be at least 6 characters.'
  if (msg.includes('admin_already_initialized')) return 'Admin is already initialized.'
  return 'Authentication failed. Please try again.'
}

export default function App() {
  const [view, setView] = useState('loading')
  const [player, setPlayer] = useState(null)
  const [sessionToken, setSessionToken] = useState('')
  const [deviceFingerprint, setDeviceFingerprint] = useState('')
  const [pendingPasswordReset, setPendingPasswordReset] = useState(null)
  const [adminBootstrapRequired, setAdminBootstrapRequired] = useState(false)
  const [weeklyScore, setWeeklyScore] = useState(0)
  const [gameConfig, setGameConfig] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [authNotice, setAuthNotice] = useState('')

  const getDeviceFingerprint = useCallback(async () => {
    if (deviceFingerprint) return deviceFingerprint
    const fp = await generateFingerprint()
    setDeviceFingerprint(fp)
    return fp
  }, [deviceFingerprint])

  const refreshAdminBootstrapStatus = useCallback(async () => {
    if (!supabase) {
      setAdminBootstrapRequired(false)
      return
    }
    const { data, error } = await supabase.rpc('needs_admin_bootstrap')
    if (!error) {
      setAdminBootstrapRequired(Boolean(data))
    }
  }, [])

  const loadWeeklyScore = useCallback(async ({ playerId, token, fingerprint }) => {
    if (!supabase || !playerId || !token || !fingerprint) return
    const { data, error } = await supabase.rpc('get_player_weekly_score', {
      _session_token: token,
      _fp_hash: fingerprint,
      _week_start: getWeekStart(),
    })
    if (error) throw error
    setWeeklyScore(Number(data) || 0)
  }, [])

  const resetToSignedOutState = useCallback(() => {
    localStorage.removeItem(PLAYER_KEY)
    localStorage.removeItem(PLAYER_SESSION_KEY)
    setPlayer(null)
    setSessionToken('')
    setPendingPasswordReset(null)
    setWeeklyScore(0)
    setView('registration')
  }, [])

  useEffect(() => {
    async function init() {
      if (!supabase) {
        const fp = await getDeviceFingerprint()
        const saved = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null')
        if (saved?.fingerprint === fp) {
          setPlayer(saved)
          setWeeklyScore(0)
          setView('hub')
          return
        }
        setView('registration')
        return
      }

      await refreshAdminBootstrapStatus()

      const savedPlayer = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null')
      const savedSession = JSON.parse(localStorage.getItem(PLAYER_SESSION_KEY) || 'null')
      if (!savedSession?.sessionToken) {
        setView('registration')
        return
      }

      try {
        const fp = await getDeviceFingerprint()
        const { data, error } = await supabase.rpc('get_player_session', {
          _session_token: savedSession.sessionToken,
          _fp_hash: fp,
        })
        if (error) throw error
        const row = extractRpcRow(data)
        if (!row) throw new Error('invalid_session')

        const restoredPlayer = {
          id: row.player_id || savedPlayer?.id,
          name: row.player_name || savedPlayer?.name || 'Player',
          fingerprint: fp,
        }

        localStorage.setItem(PLAYER_KEY, JSON.stringify(restoredPlayer))
        setSessionToken(savedSession.sessionToken)

        if (row.must_reset_password) {
          setPendingPasswordReset({
            player: restoredPlayer,
            sessionToken: savedSession.sessionToken,
          })
          setAuthNotice('Please set your password before playing.')
          setView('registration')
          return
        }

        setPendingPasswordReset(null)
        setPlayer(restoredPlayer)
        await loadWeeklyScore({
          playerId: restoredPlayer.id,
          token: savedSession.sessionToken,
          fingerprint: fp,
        })
        setAuthNotice('')
        setView('hub')
      } catch (error) {
        setAuthNotice(formatAuthError(error))
        resetToSignedOutState()
      }
    }

    init()
  }, [getDeviceFingerprint, loadWeeklyScore, refreshAdminBootstrapStatus, resetToSignedOutState])

  async function handleLocalRegister(name) {
    const normalizedName = normalizePlayerName(name)
    const fp = await getDeviceFingerprint()
    const demo = { id: crypto.randomUUID(), name: normalizedName, fingerprint: fp }
    localStorage.setItem(PLAYER_KEY, JSON.stringify(demo))
    setPlayer(demo)
    setAuthNotice('')
    setView('hub')
  }

  async function handlePlayerLogin(payload) {
    if (!payload) return
    if (!supabase) {
      await handleLocalRegister(payload.username)
      return
    }

    const fp = await getDeviceFingerprint()
    const username = normalizeUsername(payload.username)
    const password = payload.password || ''

    const { data, error } = await supabase.rpc('player_sign_in', {
      _username: username,
      _password: password,
      _fp_hash: fp,
    })

    if (error) throw new Error(formatAuthError(error), { cause: error })

    const row = extractRpcRow(data)
    if (!row?.session_token) throw new Error('Authentication failed. Please try again.')

    const nextPlayer = {
      id: row.player_id,
      name: row.player_name,
      fingerprint: fp,
    }
    const nextToken = row.session_token

    localStorage.setItem(PLAYER_KEY, JSON.stringify(nextPlayer))
    localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify({ sessionToken: nextToken }))
    setSessionToken(nextToken)

    if (row.must_reset_password) {
      setPendingPasswordReset({
        player: nextPlayer,
        sessionToken: nextToken,
      })
      setPlayer(null)
      setWeeklyScore(0)
      setAuthNotice('First login detected. Set a new password to continue.')
      setView('registration')
      return
    }

    setPendingPasswordReset(null)
    setPlayer(nextPlayer)
    await loadWeeklyScore({ playerId: nextPlayer.id, token: nextToken, fingerprint: fp })
    setAuthNotice('')
    setView('hub')
  }

  async function handleSetFirstPassword(payload) {
    if (!supabase || !pendingPasswordReset?.sessionToken) return
    const password = payload?.password || ''
    const fp = await getDeviceFingerprint()

    const { error } = await supabase.rpc('player_set_password', {
      _session_token: pendingPasswordReset.sessionToken,
      _fp_hash: fp,
      _new_password: password,
    })
    if (error) throw new Error(formatAuthError(error), { cause: error })

    setPendingPasswordReset(null)
    setPlayer(pendingPasswordReset.player)
    await loadWeeklyScore({
      playerId: pendingPasswordReset.player.id,
      token: pendingPasswordReset.sessionToken,
      fingerprint: fp,
    })
    setAuthNotice('')
    setView('hub')
  }

  async function handleBootstrapAdmin(payload) {
    if (!payload || !supabase) return
    const { error } = await supabase.rpc('bootstrap_admin', {
      _username: normalizeUsername(payload.username),
      _password: payload.password,
    })
    if (error) throw new Error(formatAuthError(error), { cause: error })

    await refreshAdminBootstrapStatus()
    setAuthNotice('First admin created. You can now create player accounts.')
  }

  async function handleCreatePlayer(payload) {
    if (!payload || !supabase) return
    const { error } = await supabase.rpc('admin_create_player', {
      _admin_username: normalizeUsername(payload.adminUsername),
      _admin_password: payload.adminPassword,
      _player_name: normalizePlayerName(payload.playerName),
      _player_username: normalizeUsername(payload.playerUsername),
      _temporary_password: payload.temporaryPassword,
    })
    if (error) throw new Error(formatAuthError(error), { cause: error })

    setAuthNotice(`Player "${normalizeUsername(payload.playerUsername)}" created successfully.`)
  }

  async function handlePlay() {
    const status = getPlayStatus()
    if (status.playsRemaining <= 0) return
    const gameType = pickRandomGame(getLastGameType())
    const difficulty = getDifficultyFromScore(weeklyScore)
    const { timeSeconds } = DIFFICULTY_CONFIG[difficulty]
    const selfGenerating = ['zippuzzle', 'wordsearch'].includes(gameType)
    const questions = selfGenerating ? [] : pickQuestions(ALL_QUESTIONS[gameType], difficulty)
    setGameConfig({ type: gameType, difficulty, questions, totalTime: timeSeconds })
    setView('game')
  }

  async function handleGameEnd(gameOutcome) {
    const normalized = Array.isArray(gameOutcome)
      ? { answers: gameOutcome, hintsUsed: 0 }
      : { answers: gameOutcome?.answers ?? [], hintsUsed: gameOutcome?.hintsUsed ?? 0 }

    const { answers, hintsUsed } = normalized
    const { total, correct, wrong, hintPenalty } = calculateFinalScore(answers, gameConfig.difficulty, hintsUsed)

    recordPlay(gameConfig.type)
    setLastGameType(gameConfig.type)

    if (supabase && player?.id && sessionToken) {
      const fp = player.fingerprint || await getDeviceFingerprint()
      const { error } = await supabase.rpc('record_player_game_session', {
        _session_token: sessionToken,
        _fp_hash: fp,
        _game_type: gameConfig.type,
        _difficulty: gameConfig.difficulty,
        _score: total,
        _correct_answers: correct,
        _wrong_answers: wrong,
        _week_start: getWeekStart(),
      })
      if (error) throw error
    }

    setWeeklyScore(prev => prev + total)
    setGameResult({
      score: total,
      correct,
      wrong,
      hintPenalty,
      hintsUsed,
      gameType: gameConfig.type,
      difficulty: gameConfig.difficulty,
    })
    setView('result')
  }

  if (view === 'loading') return (
    <div className="screen-center">
      <div className="loading-card">
        <div className="loading-logo">🎮</div>
        <p>Loading OfficeGames...</p>
      </div>
    </div>
  )

  if (view === 'registration') {
    return (
      <Registration
        onPlayerLogin={handlePlayerLogin}
        onSetFirstPassword={handleSetFirstPassword}
        onCreatePlayer={handleCreatePlayer}
        onBootstrapAdmin={handleBootstrapAdmin}
        onRegisterLocal={handleLocalRegister}
        notice={authNotice}
        requiresAuth={Boolean(supabase)}
        requiresPasswordReset={Boolean(pendingPasswordReset)}
        adminBootstrapRequired={adminBootstrapRequired}
      />
    )
  }

  if (view === 'hub') return <GameHub player={player} weeklyScore={weeklyScore} onPlay={handlePlay} onLeaderboard={() => setView('leaderboard')} />
  if (view === 'game') return <GameScreen config={gameConfig} onEnd={handleGameEnd} />
  if (view === 'result') {
    const { playsRemaining } = getPlayStatus()
    return <GameResult result={gameResult} playsRemaining={playsRemaining} onPlayAgain={handlePlay} onHub={() => setView('hub')} onLeaderboard={() => setView('leaderboard')} />
  }
  if (view === 'leaderboard') return <Leaderboard player={player} onBack={() => setView('hub')} />
  return null
}
