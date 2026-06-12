export const GAME_TYPES = [
  'anagram',
  'zippuzzle',
  'emojidecode',
  'numbersequence',
  'wordassociation',
  'wordsearch',
  'truefalse',
  'oddoneout',
  'trivia',
  'memorymatch',
]

export const GAME_META = {
  anagram:         { name: 'Anagram Rush',     emoji: '🔤', color: '#4f8ef7' },
  zippuzzle:       { name: 'Zip Puzzle',       emoji: '🧩', color: '#a855f7' },
  emojidecode:     { name: 'Emoji Decode',     emoji: '😊', color: '#f59e0b' },
  numbersequence:  { name: 'Number Sequence',  emoji: '🔢', color: '#10b981' },
  wordassociation: { name: 'Word Association', emoji: '💭', color: '#ec4899' },
  wordsearch:      { name: 'Word Search',      emoji: '🔠', color: '#00d4ff' },
  truefalse:       { name: 'True/False Blitz', emoji: '⚡', color: '#ef4444' },
  oddoneout:       { name: 'Odd One Out',      emoji: '🔍', color: '#8b5cf6' },
  trivia:          { name: 'Trivia Quiz',      emoji: '🧠', color: '#06b6d4' },
  memorymatch:     { name: 'Memory Match',     emoji: '🃏', color: '#f472b6' },
}

export function pickRandomGame(lastGameType) {
  const available = GAME_TYPES.filter(g => g !== lastGameType)
  return available[Math.floor(Math.random() * available.length)]
}

export function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function pickQuestions(allQuestions, difficulty, count = 10) {
  const filtered = allQuestions.filter(q => q.difficulty === difficulty)
  return shuffle(filtered).slice(0, count)
}

export function scrambleWord(word) {
  const arr = word.split('')
  let scrambled
  let attempts = 0
  do {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    scrambled = arr.join('')
    attempts++
  } while (scrambled === word && attempts < 20)
  return scrambled
}
