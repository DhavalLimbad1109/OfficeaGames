import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

const EXAMPLE_CSV = `game_type,difficulty,question_data
anagram,easy,"{""word"":""APPLE"",""hint"":""A fruit""}"
trivia,medium,"{""question"":""What is 2+2?"",""answer"":""4"",""choices"":[""3"",""4"",""5"",""6""]}"
truefalse,easy,"{""statement"":""The sun is a star"",""answer"":true}"`

export default function BulkImport({ adminUsername, adminPassword }) {
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState(null)

  function parseCSVLine(line) {
    const result = []
    let current = ''
    let inQuotes = false
    let i = 0
    while (i < line.length) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i += 2
        } else {
          inQuotes = !inQuotes
          i++
        }
      } else if (ch === ',' && !inQuotes) {
        result.push(current)
        current = ''
        i++
      } else {
        current += ch
        i++
      }
    }
    result.push(current)
    return result
  }

  async function handleImport() {
    if (!csvText.trim()) return
    setImporting(true)
    setResults(null)

    const lines = csvText.trim().split('\n')
    const header = lines[0].split(',').map(h => h.trim().toLowerCase())

    if (!header.includes('game_type') || !header.includes('difficulty') || !header.includes('question_data')) {
      setResults({ success: 0, failed: 0, errors: ['CSV must have columns: game_type, difficulty, question_data'] })
      setImporting(false)
      return
    }

    const gtIdx = header.indexOf('game_type')
    const diffIdx = header.indexOf('difficulty')
    const dataIdx = header.indexOf('question_data')

    let success = 0
    let failed = 0
    const errors = []

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const parts = parseCSVLine(line)
      if (parts.length < 3) { failed++; errors.push(`Line ${i+1}: not enough columns`); continue }

      const gameType = parts[gtIdx]?.trim()
      const difficulty = parts[diffIdx]?.trim()
      const rawData = parts[dataIdx]?.trim()

      try {
        const questionData = JSON.parse(rawData)
        const { error } = await supabase.rpc('admin_add_question', {
          _admin_username: adminUsername,
          _admin_password: adminPassword,
          _game_type: gameType,
          _difficulty: difficulty,
          _question_data: questionData,
        })
        if (error) throw error
        success++
      } catch (err) {
        failed++
        errors.push(`Line ${i+1}: ${err.message || 'Failed'}`)
      }
    }

    setResults({ success, failed, errors: errors.slice(0, 10) })
    setImporting(false)
  }

  return (
    <div className="bulk-import">
      <h3 className="admin-section-title">📥 Bulk Import Questions</h3>
      <p style={{ fontSize: '0.8rem', color: 'var(--muted)', marginBottom: 8 }}>
        Paste CSV with columns: game_type, difficulty, question_data (JSON)
      </p>

      <details style={{ marginBottom: 10 }}>
        <summary style={{ fontSize: '0.8rem', color: 'var(--primary2)', cursor: 'pointer' }}>
          📋 Example CSV format
        </summary>
        <pre style={{ fontSize: '0.7rem', background: 'var(--surface2)', padding: 8, borderRadius: 8, overflow: 'auto', marginTop: 6, color: 'var(--muted)' }}>
          {EXAMPLE_CSV}
        </pre>
      </details>

      <textarea
        className="bulk-textarea"
        value={csvText}
        onChange={e => setCsvText(e.target.value)}
        rows={8}
        placeholder="Paste CSV here..."
      />

      <button
        className="btn-primary"
        onClick={handleImport}
        disabled={importing || !csvText.trim()}
        style={{ marginTop: 8 }}
      >
        {importing ? 'Importing...' : '📥 Import Questions'}
      </button>

      {results && (
        <div className="bulk-results" style={{ marginTop: 12 }}>
          <p className="admin-success">✅ {results.success} imported successfully</p>
          {results.failed > 0 && <p className="admin-error">❌ {results.failed} failed</p>}
          {results.errors.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: 4 }}>
              {results.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
