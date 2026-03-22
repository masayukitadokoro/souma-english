'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { sm2, qualityFromCorrect, nextReviewDate, isMastered } from '@/lib/srs'

interface WordWithOptions {
  id: number
  word: string
  translation: string
  grade: number
  category: string
  theme?: string
  options_ja: string[]
  correct_ja: number
}

const QUESTION_TYPES = ['ja_to_en', 'en_to_ja'] as const

function buildEnOptions(word: WordWithOptions, allWords: WordWithOptions[]): { options: string[], correct: number } {
  // 同カテゴリを優先、足りなければ全単語から補完して必ず3個のdistractor確保
  const sameCat = allWords.filter(w => w.id !== word.id && w.category === word.category).sort(() => Math.random() - 0.5)
  const others = allWords.filter(w => w.id !== word.id && w.category !== word.category).sort(() => Math.random() - 0.5)
  const pool = [...sameCat, ...others]
  const distractors = pool.slice(0, 3).map(w => w.word)
  // 万が一単語数が少なくてもダミーで補完
  const fallbacks = ['tool', 'wood', 'build', 'work', 'make', 'cut', 'join', 'fix']
  while (distractors.length < 3) {
    const f = fallbacks.find(fb => fb !== word.word && !distractors.includes(fb))
    if (f) distractors.push(f)
    else break
  }
  const opts = [...distractors, word.word].sort(() => Math.random() - 0.5)
  return { options: opts, correct: opts.indexOf(word.word) }
}

function VocabContent() {
  const router = useRouter()
  const [words, setWords] = useState<WordWithOptions[]>([])
  const [current, setCurrent] = useState(0)
  const [qType, setQType] = useState<'ja_to_en' | 'en_to_ja'>('ja_to_en')
  const [options, setOptions] = useState<string[]>([])
  const [correct, setCorrect] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [askInput, setAskInput] = useState('')
  const [askAnswer, setAskAnswer] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [results, setResults] = useState<{ word_id: number; correct: boolean; usedHint: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [completed, setCompleted] = useState(false)
  const [studentId, setStudentId] = useState('')
  const [profile, setProfile] = useState<any>(null)
  const [stats, setStats] = useState({ review: 0, new: 0 })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: p } = await supabase
        .from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setStudentId(p.id)
      setProfile(p)

      const today = new Date().toISOString().split('T')[0]
      const { data: reviewRecs } = await supabase
        .from('word_records').select('word_id')
        .eq('student_id', p.id).eq('mastered', false).lte('next_review', today).limit(4)
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
      setStats({ review: data.review_count || 0, new: data.new_count || 0 })
      setLoading(false)
    }
    load()
  }, [router])

  useEffect(() => {
    if (words.length === 0 || current >= words.length) return
    const w = words[current]
    const type = QUESTION_TYPES[Math.floor(Math.random() * QUESTION_TYPES.length)]
    setQType(type)
    setShowHint(false)
    setAskInput('')
    setAskAnswer('')

    if (type === 'ja_to_en') {
      const { options: opts, correct: c } = buildEnOptions(w, words)
      setOptions(opts)
      setCorrect(c)
    } else {
      setOptions(w.options_ja)
      setCorrect(w.correct_ja)
    }
  }, [current, words])

  async function askClaude() {
    if (!words[current]) return
    const w = words[current]
    setAskLoading(true)
    const res = await fetch('/api/ask-word', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word: w.word, translation: w.translation, question: askInput }),
    })
    const data = await res.json()
    setAskAnswer(data.answer || '')
    setAskLoading(false)
  }

  function handleSelect(idx: number) {
    if (showExplanation) return
    setSelected(idx)
    setShowExplanation(true)
  }

  async function handleNext() {
    if (selected === null || !words[current]) return
    const w = words[current]
    const isCorrect = selected === correct
    const newResults = [...results, { word_id: w.id, correct: isCorrect, usedHint: showHint }]
    setResults(newResults)

    const quality = qualityFromCorrect(isCorrect, showHint)
    const { data: existing } = await supabase
      .from('word_records').select('*').eq('student_id', studentId).eq('word_id', w.id).single()

    if (existing) {
      const updated = sm2(existing, quality)
      await supabase.from('word_records').update({
        ease_factor: updated.ease_factor,
        interval_days: updated.interval_days,
        repetitions: updated.repetitions,
        next_review: nextReviewDate(updated.interval_days),
        mastered: isMastered(updated.repetitions),
        last_seen_at: new Date().toISOString(),
      }).eq('id', existing.id)
    } else {
      const init = sm2({ ease_factor: 2.5, interval_days: 1, repetitions: 0 }, quality)
      await supabase.from('word_records').insert({
        student_id: studentId, word_id: w.id, word: w.word,
        translation: w.translation, grade: w.grade,
        ease_factor: init.ease_factor, interval_days: init.interval_days,
        repetitions: init.repetitions, next_review: nextReviewDate(init.interval_days),
        mastered: isMastered(init.repetitions), last_seen_at: new Date().toISOString(),
      })
    }

    setSelected(null)
    setShowExplanation(false)
    setShowHint(false)

    if (current + 1 >= words.length) setCompleted(true)
    else setCurrent(prev => prev + 1)
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">📚</div>
        <p className="text-teal-600 font-medium">単語を選んでいます...</p>
      </div>
    </div>
  )

  if (completed) {
    const score = results.filter(r => r.correct).length
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-4 py-8">
        <div className="max-w-lg mx-auto">
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center mb-4">
            <div className="text-6xl mb-4">{score >= words.length * 0.8 ? '🏆' : '💪'}</div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">単語レッスン完了！</h1>
            <div className="text-4xl font-bold text-teal-600 mb-1">{score} / {words.length}</div>
            <p className="text-gray-500 text-sm mb-6">正解率 {Math.round((score / words.length) * 100)}%</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-teal-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-teal-600">{score}</div>
                <div className="text-xs text-gray-400">正解</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-blue-600">{stats.review}</div>
                <div className="text-xs text-gray-400">復習</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-3 text-center">
                <div className="text-xl font-bold text-purple-600">{stats.new}</div>
                <div className="text-xs text-gray-400">新単語</div>
              </div>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors">
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    )
  }

  const w = words[current]
  if (!w) return null
  const isCorrect = selected === correct
  const progress = (current / words.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 text-sm">← 戻る</button>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>📚 単語 · {qType === 'ja_to_en' ? '日→英' : '英→日'}</span>
              <span>{current + 1} / {words.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-teal-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {stats.review > 0 && current < stats.review && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 mb-3 text-xs text-blue-600">
            🔄 復習単語 ({current + 1}/{stats.review})
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4">
          {qType === 'ja_to_en' ? (
            <>
              <p className="text-xs text-gray-400 mb-1">次の日本語を英語にしてください</p>
              <p className="text-2xl font-bold text-gray-800">{w.translation}</p>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-400 mb-1">次の英語の意味は？</p>
              <p className="text-3xl font-bold text-indigo-700">{w.word}</p>
            </>
          )}
        </div>

        {!showExplanation && (
          <button onClick={() => setShowHint(!showHint)} className="text-xs text-gray-400 hover:text-teal-500 mb-3">
            💡 {showHint ? 'ヒントを隠す' : 'ヒントを見る'}
          </button>
        )}
        {showHint && !showExplanation && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-2 mb-3 text-sm text-yellow-700">
            {qType === 'ja_to_en' ? `"${w.word}" — ${w.category}` : `「${w.translation}」— ${w.category}`}
          </div>
        )}

        <div className="space-y-3 mb-4">
          {options.map((opt, idx) => {
            let style = 'border-2 border-gray-200 text-gray-700 hover:border-teal-300 hover:bg-teal-50'
            if (showExplanation) {
              if (idx === correct) style = 'border-2 border-green-400 bg-green-50 text-green-700'
              else if (idx === selected) style = 'border-2 border-red-400 bg-red-50 text-red-700'
              else style = 'border-2 border-gray-100 text-gray-400'
            }
            return (
              <button key={idx} onClick={() => handleSelect(idx)}
                className={`w-full px-4 py-3 rounded-xl text-left text-sm font-medium transition-all ${style}`}>
                <span className="mr-2 font-bold">{['A','B','C','D'][idx]}.</span>{opt}
              </button>
            )
          })}
        </div>

        {showExplanation && (
          <>
            <div className={`rounded-2xl p-4 mb-3 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
              <p className={`font-bold mb-1 text-sm ${isCorrect ? 'text-green-700' : 'text-orange-700'}`}>
                {isCorrect ? '🎉 正解！' : `😊 答えは「${qType === 'ja_to_en' ? w.word : w.translation}」`}
              </p>
              <p className="text-xs text-gray-500">{w.word} = {w.translation}（{w.category}）</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-3 mb-4">
              <p className="text-xs text-gray-400 mb-2">🤔 AIにもっと聞く</p>
              <div className="flex gap-2">
                <input type="text" value={askInput} onChange={e => setAskInput(e.target.value)}
                  placeholder="例：使い方を教えて" onKeyDown={e => e.key === 'Enter' && askInput && askClaude()}
                  className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-300" />
                <button onClick={askClaude} disabled={!askInput || askLoading}
                  className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-xs disabled:opacity-40">
                  {askLoading ? '...' : '聞く'}
                </button>
              </div>
              {askAnswer && <p className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{askAnswer}</p>}
            </div>

            <button onClick={handleNext}
              className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors">
              {current + 1 >= words.length ? '結果を見る 🎯' : '次の単語へ →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function VocabPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center"><div className="text-5xl animate-bounce">📚</div></div>}>
      <VocabContent />
    </Suspense>
  )
}
