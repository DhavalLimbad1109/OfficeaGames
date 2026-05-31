import { useState, useEffect, useCallback, useRef } from 'react'
import Timer from '../Timer.jsx'
import { getHintPenaltyPerUse } from '../../utils/scoring.js'

const WS_CONFIG = {
  easy: {
    size: 8,
    words: ['REACT', 'CODE', 'LOOP', 'BYTE', 'NODE', 'DATA'],
    dirs: [[0,1],[1,0],[0,-1],[-1,0]],
    label: '8×8 • Horizontal & Vertical',
  },
  medium: {
    size: 10,
    words: ['PYTHON', 'GITHUB', 'DOCKER', 'BINARY', 'SYNTAX', 'ASYNC', 'ARRAY', 'DEBUG'],
    dirs: [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]],
    label: '10×10 • All directions',
  },
  hard: {
    size: 12,
    words: ['ALGORITHM', 'DATABASE', 'FUNCTION', 'VARIABLE', 'INTERFACE', 'COMPILED', 'FRAMEWORK', 'PROTOCOL', 'RECURSION', 'CONTAINER'],
    dirs: [[0,1],[1,0],[0,-1],[-1,0],[1,1],[-1,1],[1,-1],[-1,-1]],
    label: '12×12 • All directions + reversed',
  },
}

const WORD_COLORS = ['#6c63ff','#10b981','#f59e0b','#ec4899','#00d4ff','#ef4444','#8b5cf6','#06b6d4','#84cc16','#fb923c']

function localShuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function generateWordSearch(size, words, dirs, allowReverse) {
  for (let gridAttempt = 0; gridAttempt < 10; gridAttempt++) {
    const grid = Array(size).fill(null).map(() => Array(size).fill(null))
    const placed = []
    const shuffledWords = localShuffle(words)
    let allPlaced = true

    for (const word of shuffledWords) {
      let wordPlaced = false
      const shuffledDirs = localShuffle(dirs)

      for (let attempt = 0; attempt < 300 && !wordPlaced; attempt++) {
        const [dr, dc] = shuffledDirs[attempt % shuffledDirs.length]
        const r = Math.floor(Math.random() * size)
        const c = Math.floor(Math.random() * size)
        const useWord = allowReverse && Math.random() < 0.4 ? word.split('').reverse().join('') : word

        const cells = []
        let fits = true
        for (let i = 0; i < useWord.length; i++) {
          const nr = r + dr * i
          const nc = c + dc * i
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) { fits = false; break }
          if (grid[nr][nc] !== null && grid[nr][nc] !== useWord[i]) { fits = false; break }
          cells.push({ r: nr, c: nc })
        }

        if (fits) {
          cells.forEach(({ r: nr, c: nc }, i) => { grid[nr][nc] = useWord[i] })
          // Store original word for matching regardless of direction used
          placed.push({ word, cells })
          wordPlaced = true
        }
      }

      if (!wordPlaced) { allPlaced = false; break }
    }

    if (!allPlaced) continue

    // Fill remaining cells
    const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++)
        if (grid[r][c] === null) grid[r][c] = ALPHA[Math.floor(Math.random() * 26)]

    return { grid, placed }
  }
  return null
}

function getLineCells(startR, startC, endR, endC, dirs) {
  const dr = endR - startR
  const dc = endC - startC
  if (dr === 0 && dc === 0) return [{ r: startR, c: startC }]

  const gcdFn = (a, b) => b === 0 ? a : gcdFn(b, a % b)
  const g = gcdFn(Math.abs(dr), Math.abs(dc))
  if (g === 0) return null
  const ndr = dr / g, ndc = dc / g

  const valid = dirs.some(([vr, vc]) => vr === ndr && vc === ndc)
  if (!valid) return null

  const cells = []
  for (let i = 0; i <= g; i++) cells.push({ r: startR + ndr * i, c: startC + ndc * i })
  return cells
}

export default function WordSearch({ difficulty, totalTime, onEnd }) {
  const cfg = WS_CONFIG[difficulty]
  const [puzzle, setPuzzle] = useState(null)
  const [foundWords, setFoundWords] = useState([]) // [{word, cells, color}]
  const [answers, setAnswers] = useState([])
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [ended, setEnded] = useState(false)
  const [selStart, setSelStart] = useState(null)
  const [selEnd, setSelEnd] = useState(null)
  const [flash, setFlash] = useState(null) // {cells, correct}
  const [hintCell, setHintCell] = useState(null)
  const [hintsUsed, setHintsUsed] = useState(0)
  const endedRef = useRef(false)
  const isDragging = useRef(false)
  const activePointerId = useRef(null)
  const activeTouchId = useRef(null)
  const pointerCaptureTarget = useRef(null)
  const gridRef = useRef(null)
  const colorIdx = useRef(0)
  const hintPenaltyPerUse = getHintPenaltyPerUse(difficulty)

  useEffect(() => {
    const p = generateWordSearch(cfg.size, cfg.words, cfg.dirs, difficulty === 'hard')
    setPuzzle(p)
  }, [])

  const endGame = useCallback((finalAnswers) => {
    if (endedRef.current) return
    endedRef.current = true
    setEnded(true)
    onEnd({
      answers: finalAnswers.length > 0 ? finalAnswers : [{ correct: false, timeLeft: 0 }],
      hintsUsed,
    })
  }, [onEnd, hintsUsed])

  useEffect(() => {
    if (ended) return
    const t = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(t); endGame(answers); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [ended, answers, endGame])

  // Check if all words found
  useEffect(() => {
    if (puzzle && foundWords.length === puzzle.placed.length) {
      endGame(answers)
    }
  }, [foundWords, puzzle, answers, endGame])

  function getCellKey(r, c) { return r * cfg.size + c }

  function commitSelection(endR, endC) {
    if (!selStart || !puzzle) { setSelStart(null); setSelEnd(null); return }
    const cells = getLineCells(selStart.r, selStart.c, endR, endC, cfg.dirs)
    if (!cells || cells.length < 2) { setSelStart(null); setSelEnd(null); return }

    const word = cells.map(({ r, c }) => puzzle.grid[r][c]).join('')
    const revWord = word.split('').reverse().join('')

    const matched = puzzle.placed.find(p =>
      !foundWords.find(f => f.word === p.word) &&
      (word === p.word || revWord === p.word)
    )

    if (matched) {
      const color = WORD_COLORS[colorIdx.current % WORD_COLORS.length]
      colorIdx.current++
      const newFound = [...foundWords, { word: matched.word, cells, color }]
      const newAnswers = [...answers, { correct: true, timeLeft }]
      setFoundWords(newFound)
      setAnswers(newAnswers)
      setFlash({ cells, correct: true })
      setTimeout(() => setFlash(null), 400)
    } else {
      setFlash({ cells, correct: false })
      setTimeout(() => setFlash(null), 400)
    }

    setSelStart(null)
    setSelEnd(null)
  }

  function handleCellPointerDown(e, r, c) {
    if (ended) return
    if (activeTouchId.current !== null) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    activePointerId.current = e.pointerId
    pointerCaptureTarget.current = e.currentTarget
    pointerCaptureTarget.current?.setPointerCapture?.(e.pointerId)
    isDragging.current = true
    setSelStart({ r, c })
    setSelEnd({ r, c })
  }

  function handleCellPointerEnter(r, c) {
    if (!isDragging.current || !selStart || ended) return
    setSelEnd({ r, c })
  }

  function clearDragging(clearSelection = false) {
    isDragging.current = false
    activePointerId.current = null
    activeTouchId.current = null
    pointerCaptureTarget.current = null
    if (clearSelection) {
      setSelStart(null)
      setSelEnd(null)
    }
  }

  function getCellFromPoint(clientX, clientY) {
    const pointEl = document.elementFromPoint(clientX, clientY)
    const cellEl = pointEl?.closest?.('[data-ws-cell="true"]')
    if (!cellEl) return null
    return { r: Number(cellEl.dataset.r), c: Number(cellEl.dataset.c) }
  }

  function getCellFromEventPoint(e) {
    return getCellFromPoint(e.clientX, e.clientY)
  }

  function handleGridPointerMove(e) {
    if (!isDragging.current || ended) return
    if (activeTouchId.current !== null) return
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return
    const cell = getCellFromEventPoint(e)
    if (!cell) return
    handleCellPointerEnter(cell.r, cell.c)
  }

  function handlePointerUp(e, fallbackR, fallbackC) {
    if (!isDragging.current) return
    if (activeTouchId.current !== null) return
    if (activePointerId.current !== null && e.pointerId !== activePointerId.current) return
    const cell = getCellFromEventPoint(e)
    const endCell = cell ?? (
      Number.isInteger(fallbackR) && Number.isInteger(fallbackC)
        ? { r: fallbackR, c: fallbackC }
        : null
    )
    if (endCell) commitSelection(endCell.r, endCell.c)
    else clearDragging(true)
    if (pointerCaptureTarget.current?.hasPointerCapture?.(e.pointerId)) {
      pointerCaptureTarget.current?.releasePointerCapture?.(e.pointerId)
    }
    clearDragging()
  }

  function handleCellTouchStart(e, r, c) {
    if (ended) return
    if (activePointerId.current !== null) return
     const touch = e.changedTouches?.[0]
    if (!touch) return
    e.preventDefault()
    activeTouchId.current = touch.identifier
    isDragging.current = true
    setSelStart({ r, c })
    setSelEnd({ r, c })
  }

  function getTrackedTouch(touchList) {
    if (!touchList || activeTouchId.current === null) return null
    for (let i = 0; i < touchList.length; i++) {
      if (touchList[i].identifier === activeTouchId.current) return touchList[i]
    }
    return null
  }

  function handleGridTouchMove(e) {
    if (!isDragging.current || ended) return
    if (activeTouchId.current === null) return
    const touch = getTrackedTouch(e.touches) ?? getTrackedTouch(e.changedTouches)
    if (!touch) return
    e.preventDefault()
    const cell = getCellFromPoint(touch.clientX, touch.clientY)
    if (!cell) return
    setSelEnd({ r: cell.r, c: cell.c })
  }

  function handleGridTouchEnd(e) {
    if (!isDragging.current) return
    if (activeTouchId.current === null) return
    const touch = getTrackedTouch(e.changedTouches) ?? getTrackedTouch(e.touches)
    e.preventDefault()
    if (!touch) {
      clearDragging(true)
      return
    }
    const cell = getCellFromPoint(touch.clientX, touch.clientY)
    const endCell = cell ?? selEnd
    if (endCell) commitSelection(endCell.r, endCell.c)
    else clearDragging(true)
    clearDragging()
  }

  function useHint() {
    if (!puzzle || ended) return
    const nextWord = puzzle.placed.find(p => !foundWords.find(f => f.word === p.word))
    if (!nextWord) return
    const firstCell = nextWord.cells[0]
    setHintCell(getCellKey(firstCell.r, firstCell.c))
    setHintsUsed(prev => prev + 1)
    setTimeout(() => setHintCell(null), 1400)
  }

  if (!puzzle) return (
    <div className="game-container">
      <p style={{ color: 'var(--muted)' }}>⚙️ Generating word grid…</p>
    </div>
  )

  const maxW = Math.min(360, (typeof window !== 'undefined' ? window.innerWidth : 400) - 24)
  const cellSize = Math.floor((maxW - (cfg.size - 1) * 2) / cfg.size)

  // Build selection set
  const selCells = new Set()
  if (selStart && selEnd) {
    const cells = getLineCells(selStart.r, selStart.c, selEnd.r, selEnd.c, cfg.dirs)
    if (cells) cells.forEach(({ r, c }) => selCells.add(getCellKey(r, c)))
  }

  // Build found cells map: key → color
  const foundCellMap = new Map()
  for (const fw of foundWords)
    for (const { r, c } of fw.cells)
      foundCellMap.set(getCellKey(r, c), fw.color)

  // Flash cells
  const flashSet = new Set()
  if (flash) flash.cells.forEach(({ r, c }) => flashSet.add(getCellKey(r, c)))

  return (
    <div className="game-container" style={{ gap: 10 }}>
      <div className="game-header">
        <h2>🔠 Word Search</h2>
        <Timer timeLeft={timeLeft} totalTime={totalTime} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>{cfg.label}</span>
        <span style={{ fontSize: '0.85rem', color: 'var(--yellow)', fontWeight: 600 }}>
          {foundWords.length}/{cfg.words.length} found
        </span>
      </div>

      <div className="game-tools">
        <button className="btn-secondary small" onClick={useHint} disabled={ended || !puzzle || foundWords.length === cfg.words.length}>
          💡 Reveal Start Cell (-{hintPenaltyPerUse})
        </button>
      </div>

      {/* Grid */}
      <div
        ref={gridRef}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cfg.size}, ${cellSize}px)`,
          gap: 2,
          touchAction: 'none',
          userSelect: 'none',
        }}
        onPointerMove={handleGridPointerMove}
        onPointerUp={e => handlePointerUp(e, selEnd?.r, selEnd?.c)}
        onPointerCancel={() => {
          clearDragging(true)
        }}
        onPointerLeave={e => {
          if (e.pointerType !== 'mouse') return
          if (isDragging.current && selEnd) {
            commitSelection(selEnd.r, selEnd.c)
            clearDragging()
          }
        }}
        onTouchMove={handleGridTouchMove}
        onTouchEnd={handleGridTouchEnd}
        onTouchCancel={() => clearDragging(true)}
      >
        {puzzle.grid.map((row, r) =>
          row.map((letter, c) => {
            const key = getCellKey(r, c)
            const foundColor = foundCellMap.get(key)
            const inSel = selCells.has(key)
            const inFlash = flashSet.has(key)
            const isHintCell = hintCell === key

            let bg = '#1a1a2e'
            let color = 'var(--text)'
            let border = '1px solid #2a2a4a'

            if (foundColor) { bg = foundColor + '33'; color = foundColor; border = `1px solid ${foundColor}66` }
            if (inSel) { bg = 'rgba(0,212,255,0.25)'; color = '#00d4ff'; border = '1px solid #00d4ff' }
            if (inFlash) {
              bg = flash.correct ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.3)'
              color = flash.correct ? '#10b981' : '#ef4444'
            }
            if (isHintCell) { bg = 'rgba(251,191,36,0.22)'; color = 'var(--yellow)'; border = '1px solid rgba(251,191,36,0.7)' }

            return (
              <div
                key={`${r}-${c}`}
                data-ws-cell="true"
                data-r={r}
                data-c={c}
                onPointerDown={e => handleCellPointerDown(e, r, c)}
                onPointerEnter={() => handleCellPointerEnter(r, c)}
                onTouchStart={e => handleCellTouchStart(e, r, c)}
                style={{
                  width: cellSize, height: cellSize,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: bg, color, border, borderRadius: 4,
                  fontSize: Math.max(10, cellSize * 0.45) + 'px',
                  fontWeight: 700, cursor: 'pointer',
                  touchAction: 'none',
                  transition: 'background 0.1s',
                }}
              >
                {letter}
              </div>
            )
          })
        )}
      </div>

      {/* Word list */}
      <div className="ws-word-list">
        {cfg.words.map(word => {
          const found = foundWords.find(f => f.word === word)
          return (
            <span
              key={word}
              className="ws-word-chip"
              style={found ? { textDecoration: 'line-through', color: found.color, borderColor: found.color + '66' } : {}}
            >
              {found ? '✓ ' : ''}{word}
            </span>
          )
        })}
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--muted)', textAlign: 'center' }}>
        Tap/click and drag to select words • {difficulty === 'hard' ? 'Words may be reversed!' : ''}
      </p>
    </div>
  )
}
