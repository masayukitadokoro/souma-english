'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import questionsData from '@/data/diagnostic_questions.json'

interface Question {
  id: string
  difficulty: string
  question: string
  passage?: string
  options: string[]
  correct: number
  explanation: string
}

const WEIGHTS: Record<string, number> = { easy: 1, medium: 2, hard: 3 }

function calcLevel(questions: Question[], answers: Record<string, number>): number {
  let score = 0, maxScore = 0
  questions.forEach(q => {
    const w = WEIGHTS[q.difficulty] || 1
    maxScore += w
    if (answers[q.id] === q.correct) score += w
  })
  return Math.max(1, Math.min(10, Math.round((score / maxScore) * 10)))
}

const PHASE_ORDER = ['vocab', 'grammar', 'reading'] as const
type Phase = typeof PHASE_ORDER[number]
const PHASE_LABEL: Record<Phase, string> = { vocab: '📚 単語', grammar: '📖 文法', reading: '📄 読解' }
const PHASE_COLOR: Record<Phase, string> = { vocab: 'bg-teal-500', grammar: 'bg-indigo-500', reading: 'bg-purple-500' }

function DiagnosticContent() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [gradeKey, setGradeKey] = useState<'grade1' | 'grade2'>('grade1')
  const [phase, setPhase] = useState<Phase>('vocab')
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [allAnswers, setAllAnswers] = useState<Record<Phase, Record<string, number>>>({ vocab: {}, grammar: {}, reading: {} })
  const [selected, setSelected] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [phaseComplete, setPhaseComplete] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [finalScores, setFinalScores] = useState<{ vocab: number; grammar: number; reading: number } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)
      const gk = p.grade === 2 ? 'grade2' : 'grade1'
      setGradeKey(gk)
      setQuestions((questionsData as any)[gk].vocabulary)
    }
    load()
  }, [router])

  function handleSelect(idx: number) {
    if (showResult) return
    setSelected(idx)
    setShowResult(true)
  }

  async function handleNext() {
    if (selected === null || !profile) return
    const q = questions[currentIdx]
    const newAnswers = { ...answers, [q.id]: selected }
    setAnswers(newAnswers)
    setSelected(null)
    setShowResult(false)

    const isLastQuestion = currentIdx + 1 >= questions.length

    if (isLastQuestion) {
      const updatedAll = { ...allAnswers, [phase]: newAnswers }
      setAllAnswers(updatedAll)

      if (phase === 'reading') {
        // 最後のフェーズ完了 → 即座に計算・保存
        setSaving(true)
        const data = (questionsData as any)[gradeKey]
        const vLevel = calcLevel(data.vocabulary, updatedAll.vocab)
        const gLevel = calcLevel(data.grammar, updatedAll.grammar)
        const rLevel = calcLevel(data.reading, updatedAll.reading)
        setFinalScores({ vocab: vLevel, grammar: gLevel, reading: rLevel })

        const weakPoints = []
        if (vLevel <= 4) weakPoints.push('単語力')
        if (gLevel <= 4) weakPoints.push('文法力')
        if (rLevel <= 4) weakPoints.push('読解力')

        try {
          const res = await fetch('/api/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              studentId: profile.id,
              goal: profile.goal,
              interests: profile.interests,
              grade: profile.grade || 1,
              scores: { vocab: vLevel, grammar: gLevel, reading: rLevel },
              weakPoints,
            }),
          })
          const planData = await res.json()
          await supabase.from('diagnostic_results').insert({
            student_id: profile.id,
            vocab_score: vLevel,
            grammar_score: gLevel,
            reading_score: rLevel,
            weak_points: weakPoints,
            learning_plan: planData,
            taken_at: new Date().toISOString(),
          })
        } catch (e) {
          console.error(e)
        }
        setSaving(false)
        setCompleted(true)
      } else {
        setPhaseComplete(true)
      }
    } else {
      setCurrentIdx(prev => prev + 1)
    }
  }

  function startNextPhase() {
    const data = (questionsData as any)[gradeKey]
    const nextPhase: Phase = phase === 'vocab' ? 'grammar' : 'reading'
    setPhase(nextPhase)
    setQuestions(nextPhase === 'grammar' ? data.grammar : data.reading)
    setCurrentIdx(0)
    setAnswers({})
    setPhaseComplete(false)
  }

  if (!profile || questions.length === 0) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
      <div className="text-5xl animate-bounce">📝</div>
    </div>
  )

  const phaseNum: Record<Phase, number> = { vocab: 1, grammar: 2, reading: 3 }
  const overallProgress = ((phaseNum[phase] - 1) * 10 + currentIdx + 1) / 30 * 100

  // 完了画面
  if (completed && finalScores) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center mb-4">
          <div className="text-5xl mb-3">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">診断完了！</h1>
          <p className="text-sm text-gray-400 mb-6">{profile.name}くんのレベルがわかりました</p>
          <div className="space-y-4 mb-6">
            {[
              { label: '📚 単語力', score: finalScores.vocab, color: 'bg-teal-500' },
              { label: '📖 文法力', score: finalScores.grammar, color: 'bg-indigo-500' },
              { label: '📄 読解力', score: finalScores.reading, color: 'bg-purple-500' },
            ].map(({ label, score, color }) => (
              <div key={label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{label}</span>
                  <span className="font-bold">レベル {score}/10</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div className={`${color} h-3 rounded-full`} style={{ width: `${score * 10}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-0.5 text-right">
                  {score <= 3 ? '基礎から丁寧に学ぼう' : score <= 6 ? 'いい感じ！さらに伸ばそう' : 'すごい！応用に挑戦しよう'}
                </p>
              </div>
            ))}
          </div>
          {saving ? (
            <p className="text-sm text-indigo-600 animate-pulse">プランを作成中...</p>
          ) : (
            <button onClick={() => router.push('/dashboard')}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-lg">
              パーソナライズプランを見る 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  )

  // フェーズ完了画面
  if (phaseComplete) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 py-8 flex items-center justify-center">
      <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-sm text-center">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">{PHASE_LABEL[phase]}パート完了！</h2>
        <p className="text-gray-500 text-sm mb-6">
          {phase === 'vocab' ? '次は文法パートです！' : '最後の読解パートです！あと少し！'}
        </p>
        <div className="flex justify-center gap-2 mb-6">
          {PHASE_ORDER.map((p, i) => (
            <div key={p} className={`w-3 h-3 rounded-full ${
              phaseNum[phase] > i ? 'bg-indigo-500' : phaseNum[phase] === i + 1 ? 'bg-indigo-300' : 'bg-gray-200'
            }`} />
          ))}
        </div>
        <button onClick={startNextPhase}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium">
          次のパートへ →
        </button>
      </div>
    </div>
  )

  const q = questions[currentIdx]
  if (!q) return null
  const isCorrect = selected === q.correct

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{PHASE_LABEL[phase]} ({currentIdx + 1}/10)</span>
            <span>全体 {Math.round(overallProgress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className={`${PHASE_COLOR[phase]} h-2 rounded-full transition-all`} style={{ width: `${overallProgress}%` }} />
          </div>
          <div className="flex gap-2 mt-2">
            {PHASE_ORDER.map((p, i) => (
              <span key={p} className={`text-xs px-2 py-0.5 rounded-full ${
                p === phase ? `${PHASE_COLOR[p]} text-white`
                : phaseNum[p] < phaseNum[phase] ? 'bg-gray-300 text-gray-500'
                : 'bg-gray-100 text-gray-400'
              }`}>
                {phaseNum[p] < phaseNum[phase] ? '✓ ' : ''}{PHASE_LABEL[p].split(' ')[1]}
              </span>
            ))}
          </div>
        </div>

        {q.passage && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-3 border-l-4 border-purple-400">
            <p className="text-xs text-gray-400 mb-1">📄 英文を読もう</p>
            <p className="text-sm text-gray-700 leading-relaxed">{q.passage}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-3">
          <div className="flex items-center gap-2 mb-3">
            <span className={`text-xs px-2 py-0.5 rounded-full text-white ${
              q.difficulty === 'easy' ? 'bg-green-400' : q.difficulty === 'medium' ? 'bg-yellow-400' : 'bg-red-400'
            }`}>
              {q.difficulty === 'easy' ? '易' : q.difficulty === 'medium' ? '中' : '難'}
            </span>
          </div>
          <p className="text-gray-800 font-medium">{q.question}</p>
        </div>

        <div className="space-y-3 mb-4">
          {q.options.map((opt, idx) => {
            let style = 'border-2 border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
            if (showResult) {
              if (idx === q.correct) style = 'border-2 border-green-400 bg-green-50 text-green-700'
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

        {showResult && (
          <>
            <div className={`rounded-xl p-3 mb-3 text-sm ${isCorrect ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
              <p className="font-bold mb-0.5">{isCorrect ? '🎉 正解！' : '😊 不正解'}</p>
              <p>{q.explanation}</p>
            </div>
            <button onClick={handleNext}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
              {currentIdx + 1 >= questions.length
                ? phase === 'reading' ? '結果を見る 🎯' : 'パート完了！ ✓'
                : '次の問題 →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function DiagnosticPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="text-5xl animate-bounce">📝</div></div>}>
      <DiagnosticContent />
    </Suspense>
  )
}
