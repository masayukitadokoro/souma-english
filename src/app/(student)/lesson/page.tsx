'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import readingData from '@/data/reading.json'
import grammarData from '@/data/grammar_data.json'

interface Question {
  question: string
  english?: string | null
  options: string[]
  correct: number
  hint: string
  explanation: string
}

interface LessonData {
  title: string
  type: string
  intro: string
  questions: Question[]
}

function buildReadingLesson(grade: number, interests: string[]): LessonData {
  const passages = readingData.passages.filter(p => p.grade <= grade)
  const makeTheme = interests.some(i => ['woodworking','crafts','making'].includes(i))
  const preferred = makeTheme
    ? passages.filter(p => ['carpenter','build','tool','house','wood'].some(k => p.title.toLowerCase().includes(k)))
    : []
  const pool = preferred.length > 0 ? preferred : passages
  const passage = pool[Math.floor(Math.random() * pool.length)]
  return {
    title: `読解：${passage.title}`,
    type: 'reading',
    intro: '次の英文を読んで、質問に答えてください。',
    questions: passage.questions.map(q => ({
      question: q.question,
      english: passage.text,
      options: q.options,
      correct: q.correct,
      hint: '本文をよく読んで、答えに関係する部分を探そう。',
      explanation: q.explanation,
    })),
  }
}

function buildGrammarLesson(topic: string, interests: string[]): LessonData {
  const unit = grammarData.units.find(u => topic.includes(u.title) || u.title.includes(topic.split('（')[0]))
    || grammarData.units[0]
  return {
    title: `文法：${unit.title}`,
    type: 'grammar',
    intro: `「${unit.title}」の使い方を練習しましょう！`,
    questions: unit.questions,
  }
}

function LessonContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const type = searchParams.get('type') || 'grammar'
  const topic = searchParams.get('topic') || 'be動詞'

  const [lesson, setLesson] = useState<LessonData | null>(null)
  const [current, setCurrent] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [showExplanation, setShowExplanation] = useState(false)
  const [showHint, setShowHint] = useState(false)
  const [answers, setAnswers] = useState<number[]>([])
  const [completed, setCompleted] = useState(false)
  const [profile, setProfile] = useState<any>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)

      if (type === 'reading') {
        setLesson(buildReadingLesson(p.grade || 1, p.interests || []))
      } else if (type === 'grammar') {
        setLesson(buildGrammarLesson(topic, p.interests || []))
      } else {
        // その他はClaude APIを呼ぶ
        try {
          const res = await fetch('/api/lesson', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, topic, interests: p.interests, goal: p.goal, skillLevel: 1, grade: p.grade || 1 }),
          })
          const data = await res.json()
          if (data.questions?.length) setLesson({ title: data.title, type, intro: data.intro, questions: data.questions })
        } catch { setLesson(null) }
      }
    }
    load()
  }, [router, type, topic])

  function handleSelect(idx: number) {
    if (showExplanation) return
    setSelected(idx)
    setShowExplanation(true)
    setShowHint(false)
  }

  async function handleNext() {
    if (!lesson) return
    const ans = selected ?? -1
    const newAnswers = [...answers, ans]
    setAnswers(newAnswers)

    if (current + 1 >= lesson.questions.length) {
      setCompleted(true)
      if (profile) {
        supabase.from('study_sessions').insert({
          student_id: profile.id,
          duration_minutes: Math.ceil(lesson.questions.length * 2),
          lesson_type: type,
        }).catch(() => {})
      }
    } else {
      setSelected(null)
      setShowHint(false)
      setShowExplanation(false)
      setCurrent(prev => prev + 1)
    }
  }

  if (!lesson) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">📚</div>
        <p className="text-indigo-600 font-medium">レッスンを準備中...</p>
      </div>
    </div>
  )

  const score = answers.filter((a, i) => a === lesson.questions[i]?.correct).length

  if (completed) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-2xl p-8 shadow-sm text-center mb-4">
          <div className="text-6xl mb-4">{score === lesson.questions.length ? '🏆' : '💪'}</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">レッスン完了！</h1>
          <div className="text-4xl font-bold text-indigo-600 mb-1">{score} / {lesson.questions.length}</div>
          <p className="text-gray-500 text-sm mb-6">正解率 {Math.round((score / lesson.questions.length) * 100)}%</p>
          <div className="bg-indigo-50 rounded-xl p-4 text-sm text-indigo-700 text-left">
            {score >= lesson.questions.length * 0.8
              ? 'すばらしい！この文法はバッチリだね！次のレベルに挑戦しよう。'
              : 'もう一度復習すると定着するよ。毎日少しずつ続けよう！'}
          </div>
        </div>
        <button onClick={() => router.push('/dashboard')}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
          ダッシュボードに戻る
        </button>
      </div>
    </div>
  )

  const q = lesson.questions[current]
  if (!q) return null
  const isCorrect = selected === q.correct
  const progress = (current / lesson.questions.length) * 100
  const typeLabel: Record<string, string> = { grammar: '📖 文法', reading: '📄 読解', vocabulary: '📚 単語', conversation: '💬 会話' }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 text-sm flex-shrink-0">← 戻る</button>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{typeLabel[type] || '📝 レッスン'} · {lesson.title}</span>
              <span>{current + 1} / {lesson.questions.length}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>

        {current === 0 && (
          <div className="bg-indigo-50 rounded-2xl p-4 mb-4 text-sm text-indigo-700">
            <p className="font-medium mb-1">🎯 {lesson.title}</p>
            <p>{lesson.intro}</p>
          </div>
        )}

        {type === 'reading' && q.english && (
          <div className="bg-white rounded-2xl p-5 shadow-sm mb-4 border-l-4 border-purple-400">
            <p className="text-xs text-gray-400 mb-2">📄 英文を読もう</p>
            <p className="text-sm text-gray-700 leading-relaxed">{q.english}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <p className="text-gray-800 font-medium">{q.question}</p>
          {type !== 'reading' && q.english && (
            <p className="text-indigo-600 font-medium text-base mt-2">{q.english}</p>
          )}
        </div>

        {!showExplanation && (
          <button onClick={() => setShowHint(!showHint)} className="text-xs text-gray-400 hover:text-indigo-500 mb-3">
            💡 {showHint ? 'ヒントを隠す' : 'ヒントを見る'}
          </button>
        )}
        {showHint && !showExplanation && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-3 text-sm text-yellow-700">{q.hint}</div>
        )}

        <div className="space-y-3 mb-4">
          {q.options.map((opt, idx) => {
            let style = 'border-2 border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
            if (showExplanation) {
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

        {showExplanation && (
          <>
            <div className={`rounded-2xl p-4 mb-4 ${isCorrect ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
              <p className={`font-bold mb-1 ${isCorrect ? 'text-green-700' : 'text-orange-700'}`}>
                {isCorrect ? '🎉 正解！' : '😊 惜しい！'}
              </p>
              <p className="text-sm text-gray-600">{q.explanation}</p>
            </div>
            <button onClick={handleNext}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
              {current + 1 >= lesson.questions.length ? '結果を見る 🎯' : '次の問題へ →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function LessonPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-5xl animate-bounce">📚</div>
      </div>
    }>
      <LessonContent />
    </Suspense>
  )
}
