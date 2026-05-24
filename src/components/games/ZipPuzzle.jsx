import { useState, useEffect, useCallback, useRef } from 'react'
import Timer from '../Timer.jsx'
import { getHintPenaltyPerUse } from '../../utils/scoring.js'

const ZIP_CONFIG = {
  easy:   { size: 4, numWaypoints: 4 },
  medium: { size: 5, numWaypoints: 5 },
  hard:   { size: 6, numWaypoints: 6 },
}

const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥']

// Warnsdorff's heuristic to find a Hamiltonian path
function generatePuzzle(size, numWaypoints) {
  function getNeighbors(r, c, visited) {
    return [[-1,0],[1,0],[0,-1],[0,1]]
      .map(([dr,dc]) => [r+dr, c+dc])
      .filter(([nr,nc]) => nr>=0 && nr<size && nc>=0 && nc<size && !visited.has(nr*size+nc))
  }

  for (let attempt = 0; attempt < 300; attempt++) {
    const sr = Math.floor(Math.random() * size)
    const sc = Math.floor(Math.random() * size)
    const visited = new Set([sr * size + sc])
    const path = [[sr, sc]]
    let r = sr, c = sc, stuck = false

    while (path.length < size * size) {
      const ns = getNeighbors(r, c, visited)
      if (ns.length === 0) { stuck = true; break }

      // Warnsdorff: pick neighbor with fewest onward moves
      let best = ns[0], bestScore = Infinity
      for (const [nr, nc] of ns) {
        visited.add(nr * size + nc)
        const score = getNeighbors(nr, nc, visited).length
        visited.delete(nr * size + nc)
        // Tie-break randomly for variety
        if (score < bestScore || (score === bestScore && Math.random() < 0.5)) {
          best = [nr, nc]; bestScore = score
        }
      }

      ;[r, c] = best
      visited.add(r * size + c)
      path.push([r, c])
    }

    if (!stuck && path.length === size * size) {
      const waypoints = []
      for (let i = 0; i < numWaypoints; i++) {
        const idx = Math.round(i * (path.length - 1) / (numWaypoints - 1))
        waypoints.push({ row: path[idx][0], col: path[idx][1], number: i + 1 })
      }
      return { size, waypoints, solution: path }
    }
  }
  return null
}

export default function ZipPuzzle({ difficulty, totalTime, onEnd }) {
  const cfg = ZIP_CONFIG[difficulty]
  const [puzzle, setPuzzle] = useState(null)
  const [path, setPath] = useState([])
  const [pathSet, setPathSet] = useState(new Set())
  const [nextWp, setNextWp] = useState(1)
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [timerActive, setTimerActive] = useState(false)
  const [ended, setEnded] = useState(false)
  const [msg, setMsg] = useState({ text: '', type: 'info' })
  const [solved, setSolved] = useState(false)
  const [hintCell, setHintCell] = useState(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const endedRef = useRef(false)
  const hintPenaltyPerUse = getHintPenaltyPerUse(difficulty)

  useEffect(() => {
    const p = generatePuzzle(cfg.size, cfg.numWaypoints)
    setPuzzle(p)
    setTimerActive(true)
  }, [])

  const endGame = useCallback((didSolve, tLeft) => {
    if (endedRef.current) return
    endedRef.current = true
    setEnded(true)
    if (didSolve) {
      setSolved(true)
      setMsg({ text: '🎉 Solved! Amazing!', type: 'correct' })
      const answers = Array(cfg.numWaypoints).fill(null).map(() => ({ correct: true, timeLeft: tLeft }))
      setTimeout(() => onEnd({ answers, hintsUsed }), 1200)
    } else {
      setMsg({ text: '⏰ Time\'s up!', type: 'wrong' })
      setTimeout(() => onEnd({ answers: [{ correct: false, timeLeft: 0 }], hintsUsed }), 300)
    }
  }, [cfg.numWaypoints, onEnd, hintsUsed])

  useEffect(() => {
    if (!timerActive || ended) return
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); endGame(false, 0); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [timerActive, ended, endGame])

  function getWpAt(r, c) {
    return puzzle?.waypoints.find(w => w.row === r && w.col === c) ?? null
  }

  function showMsg(text) {
    setMsg({ text, type: 'warn' })
    setTimeout(() => setMsg({ text: '', type: 'info' }), 1100)
  }

  function handleCellClick(r, c) {
    if (!puzzle || ended) return
    setHintCell(null)
    const key = r * puzzle.size + c

    // Empty path: must click waypoint 1
    if (path.length === 0) {
      const wp = getWpAt(r, c)
      if (wp?.number === 1) {
        setPath([[r, c]]); setPathSet(new Set([key])); setNextWp(2)
      } else {
        showMsg(`Start at ${CIRCLED[1]} first!`)
      }
      return
    }

    // Backtrack: click already-visited cell
    if (pathSet.has(key)) {
      const idx = path.findIndex(([pr, pc]) => pr === r && pc === c)
      if (idx < 0) return
      const newPath = path.slice(0, idx + 1)
      const newSet = new Set(newPath.map(([pr, pc]) => pr * puzzle.size + pc))
      // Recalculate next waypoint
      let nwp = 1
      for (const [pr, pc] of newPath) {
        const wp = getWpAt(pr, pc)
        if (wp && wp.number === nwp) nwp++
      }
      setPath(newPath); setPathSet(newSet); setNextWp(nwp)
      return
    }

    // Must be adjacent
    const [lr, lc] = path[path.length - 1]
    if (Math.abs(lr - r) + Math.abs(lc - c) !== 1) {
      showMsg('Only adjacent cells!')
      return
    }

    // Enforce waypoint order
    const wp = getWpAt(r, c)
    if (wp && wp.number !== nextWp) {
      showMsg(`Visit ${CIRCLED[nextWp]} next!`)
      return
    }

    const newPath = [...path, [r, c]]
    const newSet = new Set([...pathSet, key])
    const newNextWp = wp ? nextWp + 1 : nextWp
    setPath(newPath); setPathSet(newSet); setNextWp(newNextWp)

    // Check completion
    if (newPath.length === puzzle.size * puzzle.size) {
      const [er, ec] = newPath[newPath.length - 1]
      const lastWp = puzzle.waypoints[puzzle.waypoints.length - 1]
      if (er === lastWp.row && ec === lastWp.col) {
        endGame(true, timeLeft)
      } else {
        showMsg('All cells filled but path ends wrong!')
      }
    }
  }

  function resetPath() {
    setPath([]); setPathSet(new Set()); setNextWp(1)
    setHintCell(null)
    setMsg({ text: '', type: 'info' })
  }

  function useHint() {
    if (!puzzle || ended) return

    const solution = puzzle.solution
    for (let i = 0; i < path.length; i++) {
      if (path[i][0] !== solution[i][0] || path[i][1] !== solution[i][1]) {
        showMsg('Backtrack to your latest correct path for a hint')
        return
      }
    }

    const next = solution[path.length]
    if (!next) return
    const key = next[0] * puzzle.size + next[1]
    setHintCell(key)
    setHintsUsed(prev => prev + 1)
    setTimeout(() => setHintCell(null), 1400)
  }

  if (!puzzle) return (
    <div className="game-container">
      <p style={{ color: 'var(--muted)' }}>⚙️ Generating puzzle…</p>
    </div>
  )

  const maxW = Math.min(340, (typeof window !== 'undefined' ? window.innerWidth : 400) - 32)
  const cellSize = Math.floor((maxW - (puzzle.size - 1) * 4) / puzzle.size)
  const totalCells = puzzle.size * puzzle.size
  const progress = Math.round((path.length / totalCells) * 100)

  return (
    <div className="game-container">
      <div className="game-header">
        <h2>🧩 Zip Puzzle</h2>
        <Timer timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      <p className="zip-instructions">
        Connect <strong>{CIRCLED[1]}→{CIRCLED[2]}→{CIRCLED[3]}→…</strong> covering <strong>every</strong> cell exactly once
      </p>

      <div className="zip-meta">
        <span>{difficulty === 'easy' ? '4×4' : difficulty === 'medium' ? '5×5' : '6×6'} grid</span>
        <span>{path.length}/{totalCells} cells</span>
        <span>Next: {CIRCLED[Math.min(nextWp, puzzle.waypoints.length)]}</span>
      </div>

      <div className="timer-bar-bg" style={{ width: '100%', marginBottom: 4 }}>
        <div style={{ width: `${progress}%`, background: 'var(--primary)', height: '100%', borderRadius: 4, transition: 'width 0.15s' }} />
      </div>

      {msg.text && (
        <div className={`feedback-banner ${solved ? 'correct' : msg.type === 'warn' ? 'wrong' : ''}`}>
          {msg.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${puzzle.size}, ${cellSize}px)`, gap: 4 }}>
        {Array(puzzle.size).fill(null).map((_, r) =>
          Array(puzzle.size).fill(null).map((_, c) => {
            const key = r * puzzle.size + c
            const wp = getWpAt(r, c)
            const inPath = pathSet.has(key)
            const isLast = path.length > 0 && path[path.length - 1][0] === r && path[path.length - 1][1] === c
            const isHint = hintCell === key

            let bg = '#1a1a2e'
            let border = '2px solid #2a2a4a'
            if (solved) { bg = 'rgba(16,185,129,0.3)'; border = '2px solid #10b981' }
            else if (wp && inPath) { bg = 'rgba(245,158,11,0.5)'; border = '2px solid #f59e0b' }
            else if (wp) { bg = 'rgba(245,158,11,0.2)'; border = '2px dashed #f59e0b' }
            else if (inPath) { bg = 'rgba(108,99,255,0.4)'; border = '2px solid #6c63ff' }
            if (isHint && !inPath && !solved) { bg = 'rgba(251,191,36,0.22)'; border = '2px solid rgba(251,191,36,0.8)' }
            if (isLast && !solved) border = '3px solid #fff'

            return (
              <div
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                style={{
                  width: cellSize, height: cellSize, background: bg, border,
                  borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: ended ? 'default' : 'pointer', fontSize: wp ? `${Math.max(16, cellSize * 0.4)}px` : '10px',
                  fontWeight: 700, color: wp ? '#f59e0b' : inPath ? 'rgba(200,200,255,0.8)' : 'transparent',
                  userSelect: 'none', transition: 'background 0.1s, border 0.1s',
                }}
              >
                {wp ? CIRCLED[wp.number] : inPath ? '●' : '·'}
              </div>
            )
          })
        )}
      </div>

      <div className="zip-actions">
        <button className="btn-secondary small" onClick={resetPath} disabled={ended || path.length === 0}>
          🔄 Reset Path
        </button>
        <button className="btn-secondary small" onClick={() => {
          if (path.length > 1) {
            const newPath = path.slice(0, -1)
            const newSet = new Set(newPath.map(([r, c]) => r * puzzle.size + c))
            let nwp = 1
            for (const [pr, pc] of newPath) {
              const wp = getWpAt(pr, pc)
              if (wp && wp.number === nwp) nwp++
            }
            setPath(newPath); setPathSet(newSet); setNextWp(nwp)
          }
        }} disabled={ended || path.length <= 1}>
          ↩ Undo
        </button>
        <button className="btn-secondary small" onClick={useHint} disabled={ended}>
          💡 Next Move (-{hintPenaltyPerUse})
        </button>
      </div>

      <div className="zip-legend">
        <span><span style={{ color: '#f59e0b' }}>①</span> Waypoint</span>
        <span><span style={{ color: '#6c63ff' }}>●</span> Your path</span>
        <span style={{ color: 'var(--muted)' }}>Click waypoints in order</span>
      </div>
    </div>
  )
}
