import { useState, useEffect } from 'react'
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

export default function App() {
  const [view, setView] = useState('loading')
  const [player, setPlayer] = useState(null)
  const [weeklyScore, setWeeklyScore] = useState(0)
  const [gameConfig, setGameConfig] = useState(null)
  const [gameResult, setGameResult] = useState(null)

  async function syncSavedPlayerToSupabase(savedPlayer, fingerprint) {
    if (!supabase || !savedPlayer?.name) return null

    const { data, error } = await supabase
      .from('players')
      .upsert({ name: savedPlayer.name, fingerprint }, { onConflict: 'fingerprint' })
      .select()
      .single()

    if (!error) return data

    const { data: byFingerprint } = await supabase
      .from('players')
      .select()
      .eq('fingerprint', fingerprint)
      .maybeSingle()

    return byFingerprint || null
  }

  async function loadWeeklyScore(playerId) {
    if (!supabase || !playerId) return
    const { data } = await supabase
      .from('game_sessions')
      .select('score')
      .eq('player_id', playerId)
      .eq('week_start', getWeekStart())
    if (data) setWeeklyScore(data.reduce((s, r) => s + r.score, 0))
  }

  useEffect(() => {
    async function init() {
      const fp = await generateFingerprint()
      const saved = JSON.parse(localStorage.getItem(PLAYER_KEY) || 'null')

      if (supabase) {
        const { data: remoteByFingerprint } = await supabase
          .from('players')
          .select()
          .eq('fingerprint', fp)
          .maybeSingle()

        if (remoteByFingerprint) {
          localStorage.setItem(PLAYER_KEY, JSON.stringify(remoteByFingerprint))
          setPlayer(remoteByFingerprint)
          await loadWeeklyScore(remoteByFingerprint.id)
          setView('hub')
          return
        }

        if (saved?.fingerprint === fp) {
          const synced = await syncSavedPlayerToSupabase(saved, fp)
          if (synced) {
            localStorage.setItem(PLAYER_KEY, JSON.stringify(synced))
            setPlayer(synced)
            await loadWeeklyScore(synced.id)
            setView('hub')
            return
          }
        }

        setView('registration')
        return
      }

      if (saved?.fingerprint === fp) {
        setPlayer(saved)
        setWeeklyScore(0)
        setView('hub')
        return
      }

      setView('registration')
    }
    init()
  }, [])

  async function handleRegister(name) {
    const fp = await generateFingerprint()
    if (supabase) {
      const { data: existing } = await supabase.from('players').select('id').ilike('name', name).maybeSingle()
      if (existing) throw new Error('That name is already taken. Choose another!')
      const { data, error } = await supabase.from('players').insert({ name, fingerprint: fp }).select().single()
      if (error) {
        if (error.code === '23505') throw new Error('Name or computer/phone already registered.')
        throw new Error('Registration failed. Please try again.')
      }
      localStorage.setItem(PLAYER_KEY, JSON.stringify(data))
      setPlayer(data)
    } else {
      const demo = { id: crypto.randomUUID(), name, fingerprint: fp }
      localStorage.setItem(PLAYER_KEY, JSON.stringify(demo))
      setPlayer(demo)
    }
    setView('hub')
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

  if (view === 'registration') return <Registration onRegister={handleRegister} />
  if (view === 'hub') return <GameHub player={player} weeklyScore={weeklyScore} onPlay={handlePlay} onLeaderboard={() => setView('leaderboard')} />
  if (view === 'game') return <GameScreen config={gameConfig} onEnd={handleGameEnd} />
  if (view === 'result') {
    const { playsRemaining } = getPlayStatus()
    return <GameResult result={gameResult} playsRemaining={playsRemaining} onPlayAgain={handlePlay} onHub={() => setView('hub')} onLeaderboard={() => setView('leaderboard')} />
  }
  if (view === 'leaderboard') return <Leaderboard player={player} onBack={() => setView('hub')} />
  return null
}
