import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { GAME_META } from '../utils/gameUtils.js'

const GAME_FIELDS = {
  anagram: [
    { key: 'word', label: 'Word', placeholder: 'e.g. DOLPHIN' },
    { key: 'hint', label: 'Hint', placeholder: 'e.g. Intelligent sea mammal' },
  ],
  emojidecode: [
    { key: 'emojis', label: 'Emojis', placeholder: 'e.g. 🎂🕯️' },
    { key: 'answer', label: 'Answer', placeholder: 'e.g. BIRTHDAY' },
    { key: 'choice1', label: 'Choice 1 (correct)', placeholder: 'Same as answer' },
    { key: 'choice2', label: 'Choice 2', placeholder: 'Wrong option' },
    { key: 'choice3', label: 'Choice 3', placeholder: 'Wrong option' },
    { key: 'choice4', label: 'Choice 4', placeholder: 'Wrong option' },
  ],
  numbersequence: [
    { key: 'sequence', label: 'Sequence', placeholder: 'e.g. 2, 4, 6, ?, 10' },
    { key: 'answer', label: 'Answer', placeholder: 'e.g. 8' },
    { key: 'choice1', label: 'Choice 1 (correct)', placeholder: 'Same as answer' },
    { key: 'choice2', label: 'Choice 2', placeholder: 'Wrong option' },
    { key: 'choice3', label: 'Choice 3', placeholder: 'Wrong option' },
    { key: 'choice4', label: 'Choice 4', placeholder: 'Wrong option' },
  ],
  wordassociation: [
    { key: 'word', label: 'Word', placeholder: 'e.g. OCEAN' },
    { key: 'answer', label: 'Answer', placeholder: 'e.g. Wave' },
    { key: 'choice1', label: 'Choice 1 (correct)', placeholder: 'Same as answer' },
    { key: 'choice2', label: 'Choice 2', placeholder: 'Wrong option' },
    { key: 'choice3', label: 'Choice 3', placeholder: 'Wrong option' },
    { key: 'choice4', label: 'Choice 4', placeholder: 'Wrong option' },
  ],
  truefalse: [
    { key: 'statement', label: 'Statement', placeholder: 'e.g. The Earth is flat' },
    { key: 'answer', label: 'Answer (true/false)', placeholder: 'true or false' },
  ],
  oddoneout: [
    { key: 'option1', label: 'Option 1', placeholder: 'e.g. Apple' },
    { key: 'option2', label: 'Option 2', placeholder: 'e.g. Banana' },
    { key: 'option3', label: 'Option 3', placeholder: 'e.g. Carrot' },
    { key: 'option4', label: 'Option 4', placeholder: 'e.g. Grape' },
    { key: 'answer', label: 'Odd One (answer)', placeholder: 'e.g. Carrot' },
    { key: 'hint', label: 'Hint', placeholder: 'e.g. Three are fruits' },
  ],
  trivia: [
    { key: 'question', label: 'Question', placeholder: 'e.g. What is the capital of France?' },
    { key: 'answer', label: 'Answer', placeholder: 'e.g. Paris' },
    { key: 'choice1', label: 'Choice 1 (correct)', placeholder: 'Same as answer' },
    { key: 'choice2', label: 'Choice 2', placeholder: 'Wrong option' },
    { key: 'choice3', label: 'Choice 3', placeholder: 'Wrong option' },
    { key: 'choice4', label: 'Choice 4', placeholder: 'Wrong option' },
  ],
}

// Games that don't use question banks
const SELF_GENERATING = ['zippuzzle', 'wordsearch', 'memorymatch']

function buildQuestionData(gameType, fields) {
  if (gameType === 'anagram') {
    return { word: fields.word?.toUpperCase(), hint: fields.hint }
  }
  if (gameType === 'emojidecode') {
    return {
      emojis: fields.emojis,
      answer: fields.answer?.toUpperCase(),
      choices: [fields.choice1 || fields.answer, fields.choice2, fields.choice3, fields.choice4].map(c => c?.toUpperCase()),
    }
  }
  if (gameType === 'numbersequence') {
    const answer = isNaN(fields.answer) ? fields.answer : Number(fields.answer)
    return {
      sequence: fields.sequence,
      answer,
      choices: [fields.choice1 || fields.answer, fields.choice2, fields.choice3, fields.choice4].map(c => isNaN(c) ? c : Number(c)),
    }
  }
  if (gameType === 'wordassociation') {
    return {
      word: fields.word?.toUpperCase(),
      answer: fields.answer,
      choices: [fields.choice1 || fields.answer, fields.choice2, fields.choice3, fields.choice4],
    }
  }
  if (gameType === 'truefalse') {
    return {
      statement: fields.statement,
      answer: fields.answer?.toLowerCase() === 'true',
    }
  }
  if (gameType === 'oddoneout') {
    return {
      items: [fields.option1, fields.option2, fields.option3, fields.option4],
      answer: fields.answer,
      hint: fields.hint,
    }
  }
  if (gameType === 'trivia') {
    return {
      question: fields.question,
      answer: fields.answer,
      choices: [fields.choice1 || fields.answer, fields.choice2, fields.choice3, fields.choice4],
    }
  }
  return fields
}

function questionSummary(gameType, data) {
  if (gameType === 'anagram') return `${data.word} — "${data.hint}"`
  if (gameType === 'emojidecode') return `${data.emojis} → ${data.answer}`
  if (gameType === 'numbersequence') return `${data.sequence} → ${data.answer}`
  if (gameType === 'wordassociation') return `${data.word} → ${data.answer}`
  if (gameType === 'truefalse') return `${data.statement} → ${data.answer ? 'TRUE' : 'FALSE'}`
  if (gameType === 'oddoneout') return `[${(data.items || data.options)?.join(', ')}] odd: ${data.answer}`
  if (gameType === 'trivia') return `${data.question} → ${data.answer}`
  return JSON.stringify(data).slice(0, 60)
}

export default function QuestionManager({ adminUsername, adminPassword }) {
  const [gameType, setGameType] = useState('anagram')
  const [difficulty, setDifficulty] = useState('easy')
  const [fields, setFields] = useState({})
  const [questions, setQuestions] = useState([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [showList, setShowList] = useState(false)

  function updateField(key, value) {
    setFields(prev => ({ ...prev, [key]: value }))
    setError('')
  }

  async function handleAdd(e) {
    e.preventDefault()
    const fieldDefs = GAME_FIELDS[gameType]
    if (!fieldDefs) return

    for (const f of fieldDefs) {
      if (!fields[f.key]?.trim()) {
        setError(`Please fill "${f.label}".`)
        return
      }
    }

    setLoading(true)
    setError('')
    setMessage('')
    try {
      const questionData = buildQuestionData(gameType, fields)
      const { error: rpcError } = await supabase.rpc('admin_add_question', {
        _admin_username: adminUsername,
        _admin_password: adminPassword,
        _game_type: gameType,
        _difficulty: difficulty,
        _question_data: questionData,
      })
      if (rpcError) throw rpcError
      setMessage('Question added!')
      setFields({})
      if (showList) loadQuestions()
    } catch (err) {
      setError(err?.message || 'Failed to add question.')
    } finally {
      setLoading(false)
    }
  }

  async function loadQuestions() {
    setListLoading(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_list_questions', {
        _admin_username: adminUsername,
        _admin_password: adminPassword,
        _game_type: gameType,
        _difficulty: difficulty,
      })
      if (rpcError) throw rpcError
      setQuestions(data || [])
      setShowList(true)
    } catch (err) {
      setError(err?.message || 'Failed to load questions.')
    } finally {
      setListLoading(false)
    }
  }

  async function handleToggle(id) {
    try {
      const { error: rpcError } = await supabase.rpc('admin_toggle_question', {
        _admin_username: adminUsername,
        _admin_password: adminPassword,
        _question_id: id,
      })
      if (rpcError) throw rpcError
      loadQuestions()
    } catch (err) {
      setError(err?.message || 'Failed to toggle question.')
    }
  }

  async function handleDelete(id) {
    try {
      const { error: rpcError } = await supabase.rpc('admin_delete_question', {
        _admin_username: adminUsername,
        _admin_password: adminPassword,
        _question_id: id,
      })
      if (rpcError) throw rpcError
      loadQuestions()
    } catch (err) {
      setError(err?.message || 'Failed to delete question.')
    }
  }

  const fieldDefs = GAME_FIELDS[gameType] || []
  const manageable = !SELF_GENERATING.includes(gameType)

  return (
    <div className="qm-container">
      <div className="qm-selectors">
        <select value={gameType} onChange={e => { setGameType(e.target.value); setFields({}); setShowList(false); setError(''); setMessage('') }}>
          {Object.entries(GAME_META)
            .filter(([key]) => !SELF_GENERATING.includes(key))
            .map(([key, meta]) => (
              <option key={key} value={key}>{meta.emoji} {meta.name}</option>
            ))}
        </select>
        <select value={difficulty} onChange={e => { setDifficulty(e.target.value); setShowList(false) }}>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </div>

      {manageable && (
        <form onSubmit={handleAdd} className="qm-form">
          {fieldDefs.map(f => (
            <input
              key={f.key}
              type="text"
              placeholder={f.placeholder}
              value={fields[f.key] || ''}
              onChange={e => updateField(f.key, e.target.value)}
              autoComplete="off"
            />
          ))}
          {message && <p className="admin-success">{message}</p>}
          {error && <p className="admin-error">{error}</p>}
          <div className="qm-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Adding...' : '+ Add Question'}
            </button>
            <button type="button" className="btn-secondary small" onClick={loadQuestions} disabled={listLoading}>
              {listLoading ? 'Loading...' : 'View Questions'}
            </button>
          </div>
        </form>
      )}

      {showList && (
        <div className="qm-list">
          <div className="qm-list-header">
            {GAME_META[gameType]?.emoji} {GAME_META[gameType]?.name} — {difficulty} ({questions.length})
          </div>
          {questions.length === 0 && <p className="qm-empty">No questions found.</p>}
          {questions.map(q => (
            <div key={q.id} className={`qm-item ${q.active ? '' : 'qm-inactive'}`}>
              <span className="qm-text">{questionSummary(gameType, q.question_data)}</span>
              <div className="qm-item-actions">
                <button
                  className={`qm-toggle ${q.active ? 'active' : ''}`}
                  onClick={() => handleToggle(q.id)}
                  title={q.active ? 'Disable' : 'Enable'}
                >
                  {q.active ? 'ON' : 'OFF'}
                </button>
                <button className="qm-delete" onClick={() => handleDelete(q.id)} title="Delete">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
