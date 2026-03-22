'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sm2, qualityFromCorrect, nextReviewDate, isMastered } from '@/lib/srs'

interface WordItem {
  id: number
  word: string
  translation: string
  category: string
  theme?: string
  options_ja: string[]
  correct_ja: number
  example_en?: string
  example_ja?: string
}

type Direction = 'ja_to_en' | 'en_to_ja'

function fuzzyMatch(input: string, answer: string): boolean {
  const a = input.trim().toLowerCase()
  const b = answer.trim().toLowerCase()
  if (a === b) return true
  // 末尾ピリオド許容
  if (a.replace(/\.$/, '') === b.replace(/\.$/, '')) return true
  // レーベンシュタイン距離1以内（短い単語は完全一致）
  if (b.length <= 4) return a === b
  return levenshtein(a, b) <= 1
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  }
  return dp[m][n]
}

function speak(text: string, lang = 'en-US') {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang
  u.rate = 0.85
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

function TypingContent() {
  const router = useRouter()
  const [words, setWords] = useState<WordItem[]>([])
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState<Direction>('ja_to_en')
  const [input, setInput] = useState('')
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [showAnswer, setShowAnswer] = useState(false)
  const [results, setResults] = useState<{ word: WordItem; correct: boolean; direction: Direction }[]>([])
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setStudentId(p.id)
      setProfile(p)

      const today = new Date().toISOString().split('T')[0]
      const { data: reviewRecs } = await supabase
        .from('word_records').select('word_id')
        .eq('student_id', p.id).eq('mastered', false).lte('next_review', today).limit(6)
      const { data: seenRecs } = await supabase
        .from('word_records').select('word_id').eq('student_id', p.id)

      const reviewIds = reviewRecs?.map(r => r.word_id) || []
      const seenIds = seenRecs?.map(r => r.word_id) || []

      const res = await fetch('/api/vocab-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade: 1, interests: p.interests, reviewWordIds: reviewIds, seenWordIds: seenIds, count: 10 }),
      })
      const data = await res.json()
      setWords(data.words || [])
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (!loading && inputRef.current) inputRef.current.focus()
  }, [loading, current])

  function getQuestion(w: WordItem, dir: Direction) {
    return dir === 'ja_to_en' ? w.translation : w.word
  }
  function getAnswer(w: WordItem, dir: Direction) {
    return dir === 'ja_to_en' ? w.word : w.translation
  }

  function handleSubmit() {
    if (!words[current] || result) return
    const w = words[current]
    const answer = getAnswer(w, direction)
    const isCorrect = direction === 'ja_to_en'
      ? fuzzyMatch(input, answer)
      : fuzzyMatch(input, answer) || w.options_ja.some(o => fuzzyMatch(input, o))
    setResult(isCorrect ? 'correct' : 'wrong')
    setShowAnswer(!isCorrect)
    if (direction === 'ja_to_en') speak(w.word)
  }

  function handleNext() {
    if (!words[current]) return
    const w = words[current]
    const isCorrect = result === 'correct'
    const newResults = [...results, { word: w, correct: isCorrect, direction }]
    setResults(newResults)

    // 画面を先に切り替え
    if (current + 1 >= words.length) {
      setCompleted(true)
    } else {
      setCurrent(prev => prev + 1)
      setInput('')
      setResult(null)
      setShowAnswer(false)
      setDirection(Math.random() > 0.5 ? 'ja_to_en' : 'en_to_ja')
    }

    // SRS更新はバックグラウンドで（awaitしない）
    if (studentId) {
      supabase.from('word_records').select('*').eq('student_id', studentId).eq('word_id', w.id).single()
        .then(({ data: rec }) => {
          const quality = qualityFromCorrect(isCorrect, false)
          if (rec) {
            const updated = sm2(rec.ease_factor, rec.interval_days, rec.repetitions, quality)
            supabase.from('word_records').update({
              ease_factor: updated.easeFactor,
              interval_days: updated.interval,
              repetitions: updated.repetitions,
              next_review: nextReviewDate(updated.interval),
              mastered: isMastered(updated.repetitions, updated.easeFactor),
            }).eq('id', rec.id)
          } else {
            const updated = sm2(2.5, 0, 0, quality)
            supabase.from('word_records').insert({
              student_id: studentId,
              word_id: w.id,
              word: w.word,
              ease_factor: updated.easeFactor,
              interval_days: updated.interval,
              repetitions: updated.repetitions,
              next_review: nextReviewDate(updated.interval),
              mastered: isMastered(updated.repetitions, updated.easeFactor),
            })
          }
        })
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (result) handleNext()
      else handleSubmit()
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 48, animation: 'bounce 1s infinite' }}>⌨️</div>
    </div>
  )

  const correctCount = results.filter(r => r.correct).length

  if (completed) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 32, textAlign: 'center', marginBottom: 16, border: '1px solid #e0f2fe' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{correctCount >= 8 ? '🏆' : correctCount >= 5 ? '💪' : '📚'}</div>
          <h1 style={{ fontSize: 22, fontWeight: 500, color: '#0c4a6e', margin: '0 0 4px' }}>タイピング練習完了！</h1>
          <p style={{ color: '#7dd3fc', fontSize: 13, margin: '0 0 24px' }}>10問お疲れ様でした</p>
          <div style={{ fontSize: 40, fontWeight: 500, color: '#0ea5e9', margin: '0 0 4px' }}>{correctCount} / {words.length}</div>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 24 }}>正解率 {Math.round((correctCount / words.length) * 100)}%</p>

          {/* 苦手語リスト */}
          {results.filter(r => !r.correct).length > 0 && (
            <div style={{ background: '#fff7ed', borderRadius: 14, padding: '12px 16px', marginBottom: 20, textAlign: 'left' }}>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#c2410c', marginBottom: 8 }}>📌 要復習の単語</p>
              {results.filter(r => !r.correct).map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', borderBottom: '0.5px solid #fed7aa' }}>
                  <span style={{ color: '#9a3412' }}>{r.word.translation}</span>
                  <span style={{ color: '#c2410c', fontWeight: 500 }}>{r.word.word}</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => router.push('/words')}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid #bae6fd', background: 'white', color: '#0369a1', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              単語帳へ
            </button>
            <button onClick={() => { setCurrent(0); setResults([]); setCompleted(false); setInput(''); setResult(null); setShowAnswer(false) }}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: '#0ea5e9', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
              もう一度
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const w = words[current]
  if (!w) return null
  const question = getQuestion(w, direction)
  const answer = getAnswer(w, direction)
  const progress = (current / words.length) * 100

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <button onClick={() => router.push('/words')}
            style={{ color: '#94a3b8', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>← 戻る</button>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>
              <span>⌨️ タイピング練習</span>
              <span>{current + 1} / {words.length}</span>
            </div>
            <div style={{ background: '#bae6fd', borderRadius: 6, height: 6, overflow: 'hidden' }}>
              <div style={{ background: '#0ea5e9', height: '100%', borderRadius: 6, width: `${progress}%`, transition: 'width .4s' }} />
            </div>
          </div>
        </div>

        {/* 方向バッジ */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: direction === 'ja_to_en' ? '#0ea5e9' : '#f1f5f9', color: direction === 'ja_to_en' ? 'white' : '#64748b', fontWeight: 500 }}>
            日本語 → 英語
          </span>
          <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: direction === 'en_to_ja' ? '#0ea5e9' : '#f1f5f9', color: direction === 'en_to_ja' ? 'white' : '#64748b', fontWeight: 500 }}>
            英語 → 日本語
          </span>
        </div>

        {/* 問題カード */}
        <div style={{ background: 'white', borderRadius: 20, padding: 28, marginBottom: 16, border: '1.5px solid #bae6fd', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>
            {direction === 'ja_to_en' ? '日本語を英語でタイプしよう' : '英語を日本語でタイプしよう'}
          </p>

          {/* 問題テキスト */}
          <div style={{ fontSize: 32, fontWeight: 500, color: '#0c4a6e', marginBottom: 16, minHeight: 48 }}>
            {question}
          </div>

          {/* 音声ボタン（英語が問題の場合） */}
          {direction === 'en_to_ja' && (
            <button onClick={() => speak(w.word)}
              style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 10, padding: '6px 16px', fontSize: 13, color: '#0369a1', cursor: 'pointer', marginBottom: 16 }}>
              🔊 発音を聞く
            </button>
          )}

          {/* カテゴリバッジ */}
          <div>
            <span style={{ fontSize: 10, background: '#f1f5f9', color: '#64748b', padding: '2px 8px', borderRadius: 10 }}>
              {w.category}
            </span>
          </div>
        </div>

        {/* 入力エリア */}
        <div style={{ marginBottom: 12 }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!!result}
            placeholder={direction === 'ja_to_en' ? '英語でタイプ...' : '日本語でタイプ...'}
            style={{
              width: '100%', padding: '16px 20px', borderRadius: 14, fontSize: 18,
              border: result === 'correct' ? '2px solid #22c55e' : result === 'wrong' ? '2px solid #ef4444' : '2px solid #bae6fd',
              background: result === 'correct' ? '#f0fdf4' : result === 'wrong' ? '#fff1f2' : 'white',
              outline: 'none', color: '#0c4a6e', fontWeight: 500,
              textAlign: 'center',
            }}
          />
        </div>

        {/* 正誤フィードバック */}
        {result && (
          <div style={{
            background: result === 'correct' ? '#f0fdf4' : '#fff1f2',
            border: `1.5px solid ${result === 'correct' ? '#86efac' : '#fca5a5'}`,
            borderRadius: 14, padding: '14px 16px', marginBottom: 12,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: showAnswer ? 8 : 0 }}>
              <span style={{ fontSize: 20 }}>{result === 'correct' ? '🎉' : '😊'}</span>
              <span style={{ fontWeight: 500, fontSize: 15, color: result === 'correct' ? '#15803d' : '#dc2626' }}>
                {result === 'correct' ? '正解！' : `不正解 → 正解: ${answer}`}
              </span>
              {/* 英語の場合は発音ボタン */}
              {direction === 'ja_to_en' && (
                <button onClick={() => speak(w.word)}
                  style={{ marginLeft: 'auto', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#0369a1', cursor: 'pointer' }}>
                  🔊 {w.word}
                </button>
              )}
            </div>
            {w.example_en && (
              <div style={{ fontSize: 12, color: '#64748b', paddingLeft: 28 }}>
                <div style={{ color: '#0369a1' }}>{w.example_en}</div>
                <div>{w.example_ja}</div>
              </div>
            )}
          </div>
        )}

        {/* ボタン */}
        {!result ? (
          <button onClick={handleSubmit} disabled={!input.trim()}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: input.trim() ? '#0ea5e9' : '#e2e8f0', color: input.trim() ? 'white' : '#94a3b8', fontSize: 15, fontWeight: 500, cursor: input.trim() ? 'pointer' : 'default', transition: 'all .2s' }}>
            確認する（Enterキーでも可）
          </button>
        ) : (
          <button onClick={handleNext}
            style={{ width: '100%', padding: '16px', borderRadius: 14, border: 'none', background: '#0ea5e9', color: 'white', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
            {current + 1 >= words.length ? '結果を見る 🏆' : '次の単語 →'}
          </button>
        )}

        {/* 正解率インジケーター */}
        {results.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginTop: 16, justifyContent: 'center' }}>
            {results.map((r, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: r.correct ? '#22c55e' : '#ef4444' }} />
            ))}
            {Array.from({ length: words.length - results.length }).map((_, i) => (
              <div key={`e${i}`} style={{ width: 8, height: 8, borderRadius: '50%', background: '#e2e8f0' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function VocabTypingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 48 }}>⌨️</div>
      </div>
    }>
      <TypingContent />
    </Suspense>
  )
}
