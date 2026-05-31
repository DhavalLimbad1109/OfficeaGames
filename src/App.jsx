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
const PENDING_NAME_KEY = 'og_pending_player_name'

function fallbackNameFromEmail(email) {
  const [raw] = (email || '').split('@')
  const cleaned = (raw || 'Player').replace(/[^a-zA-Z0-9_ ]/g, '').trim()
  return cleaned.slice(0, 20) || 'Player'
}

function normalizePlayerName(name) {
  const cleaned = (name || '').trim().replace(/\s+/g, ' ')
  return cleaned.slice(0, 20)
}

function formatClaimError(error) {
  const msg = error?.message || ''
  if (msg.includes('device_already_registered')) return 'This device is already linked to another account.'
  if (msg.includes('account_locked_to_another_device')) return 'This account is locked to another device.'
  if (msg.includes('player_name_taken')) return 'This player name is already taken.'
  if (msg.includes('invalid_player_name')) return 'Name must be 2-20 chars (letters, numbers, spaces, underscore).'
  if (msg.includes('missing_player_name')) return 'Please choose a player name first.'
  if (msg.includes('missing_fingerprint')) return 'Could not verify this device. Please try again.'
  if (msg.includes('Token has expired') || msg.includes('invalid')) return 'Invalid or expired OTP. Please request a new code.'
  if (msg.includes('Email rate limit exceeded')) return 'Too many OTP requests. Please wait and try again.'
  if (msg.includes('Signups not allowed')) return 'Signups are currently disabled for this project.'
  return 'Authentication failed. Please try again.'
}

export default function App() {
  const [view, setView] = useState('loading')
  const [player, setPlayer] = useState(null)
  const [weeklyScore, setWeeklyScore] = useState(0)
  const [gameConfig, setGameConfig] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [authNotice, setAuthNotice] = useState('')

  const loadWeeklyScore = useCallback(async playerId => {
    if (!supabase || !playerId) return
    const { data } = await supabase
      .from('game_sessions')
      .select('score')
      .eq('player_id', playerId)
      .eq('week_start', getWeekStart())
    if (data) setWeeklyScore(data.reduce((s, r) => s + r.score, 0))
  }, [])

  const hydrateSignedInPlayer = useCallback(async (session, preferredName) => {
    if (!supabase || !session?.user) throw new Error('Authentication failed. Please sign in again.')

    const fingerprint = await generateFingerprint()
    const suggestedName = normalizePlayerName(
      preferredName
        || localStorage.getItem(PENDING_NAME_KEY)
        || session.user.user_metadata?.player_name
        || fallbackNameFromEmail(session.user.email)
    )

    const { data, error } = await supabase.rpc('claim_device_profile', {
      _fp_hash: fingerprint,
      _name: suggestedName || null,
    })

    if (error) throw error

    localStorage.setItem(PLAYER_KEY, JSON.stringify(data))
    localStorage.removeItem(PENDING_NAME_KEY)
    setPlayer(data)
    await loadWeeklyScore(data.id)
    setAuthNotice('')
    setView('hub')
  }, [loadWeeklyScore])

  const resetToSignedOutState = useCallback(async () => {
    localStorage.removeItem(PLAYER_KEY)
    setPlayer(null)
    setWeeklyScore(0)
    setView('registration')
  }, [])

  useEffect(() => {
    async function init() {
      if (!supabase) {
        const fp = await generateFingerprint()
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

      const { data: sessionData } = await supabase.auth.getSession()
      const session = sessionData?.session
      if (!session) {
        await resetToSignedOutState()
        return
      }

      try {
        await hydrateSignedInPlayer(session)
      } catch (error) {
        await supabase.auth.signOut()
        setAuthNotice(formatClaimError(error))
        await resetToSignedOutState()
      }
    }

    init()

    if (!supabase) return undefined
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        void resetToSignedOutState()
      }
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [hydrateSignedInPlayer, resetToSignedOutState])

  async function handleLocalRegister(name) {
    const normalizedName = normalizePlayerName(name)
    const fp = await generateFingerprint()
    const demo = { id: crypto.randomUUID(), name: normalizedName, fingerprint: fp }
    localStorage.setItem(PLAYER_KEY, JSON.stringify(demo))
    setPlayer(demo)
    setAuthNotice('')
    setView('hub')
  }

  async function handleSendOtp(payload) {
    if (!payload) return

    if (!supabase) {
      await handleLocalRegister(payload.name)
      return
    }

    const email = (payload.email || '').trim().toLowerCase()
    const mode = payload.mode === 'signin' ? 'signin' : 'signup'
    const name = normalizePlayerName(payload.name)

    if (mode === 'signup') {
      const fp = await generateFingerprint()
      const [{ data: isDeviceAvailable, error: deviceError }, { data: isNameAvailable, error: nameError }] = await Promise.all([
        supabase.rpc('is_device_available', { _fp_hash: fp }),
        supabase.rpc('is_player_name_available', { _name: name }),
      ])

      if (deviceError || nameError) throw new Error('Could not validate sign-up. Please try again.')
      if (!isDeviceAvailable) throw new Error('This device is already linked to another account.')
      if (!isNameAvailable) throw new Error('That player name is already taken.')

      localStorage.setItem(PENDING_NAME_KEY, name)
    } else {
      localStorage.removeItem(PENDING_NAME_KEY)
    }

    const otpOptions = mode === 'signup'
      ? {
          shouldCreateUser: true,
          data: { player_name: name },
          emailRedirectTo: window.location.origin,
        }
      : {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        }

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: otpOptions,
    })

    if (error) throw new Error(formatClaimError(error), { cause: error })
    setAuthNotice(`OTP sent to ${email}.`)
  }

  async function handleVerifyOtp(payload) {
    if (!payload || !supabase) return

    const email = (payload.email || '').trim().toLowerCase()
    const token = (payload.token || '').trim()
    const mode = payload.mode === 'signin' ? 'signin' : 'signup'
    const name = normalizePlayerName(payload.name)

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: mode === 'signup' ? 'signup' : 'email',
    })

    if (error) throw new Error(formatClaimError(error), { cause: error })
    if (!data?.session) throw new Error('OTP verification failed. Please request a new code.')

    try {
      await hydrateSignedInPlayer(data.session, mode === 'signup' ? name : undefined)
    } catch (claimError) {
      await supabase.auth.signOut()
      throw new Error(formatClaimError(claimError), { cause: claimError })
    }
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
    if (supabase && player?.id) {
      await supabase.from('game_sessions').insert({
        player_id: player.id,
        game_type: gameConfig.type,
        difficulty: gameConfig.difficulty,
        score: total,
        correct_answers: correct,
        wrong_answers: wrong,
        week_start: getWeekStart(),
      })
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
        onSendOtp={handleSendOtp}
        onVerifyOtp={handleVerifyOtp}
        onRegisterLocal={handleLocalRegister}
        notice={authNotice}
        requiresAuth={Boolean(supabase)}
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
