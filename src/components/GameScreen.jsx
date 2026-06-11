import AnagramRush from './games/AnagramRush.jsx'
import ZipPuzzle from './games/ZipPuzzle.jsx'
import EmojiDecode from './games/EmojiDecode.jsx'
import NumberSequence from './games/NumberSequence.jsx'
import WordAssociation from './games/WordAssociation.jsx'
import WordSearch from './games/WordSearch.jsx'

const GAME_MAP = {
  anagram:         AnagramRush,
  zippuzzle:       ZipPuzzle,
  emojidecode:     EmojiDecode,
  numbersequence:  NumberSequence,
  wordassociation: WordAssociation,
  wordsearch:      WordSearch,
}

export default function GameScreen({ config, onEnd, onClose }) {
  const GameComponent = GAME_MAP[config.type]
  if (!GameComponent) return <div>Unknown game type</div>

  return (
    <>
      <div className="game-exit-bar">
        <button className="btn-secondary small game-close-btn" onClick={onClose}>
          ✖ Close Game
        </button>
      </div>
      <GameComponent
        key={config.type}
        questions={config.questions}
        difficulty={config.difficulty}
        totalTime={config.totalTime}
        onEnd={onEnd}
      />
    </>
  )
}
