'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isEnglishAnswerCorrect } from '@/lib/answer-check'
import { Volume2, CheckCircle, XCircle, ArrowLeft, Keyboard, Trophy, RotateCcw } from 'lucide-react'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-US'; u.rate = 0.85
  speechSynthesis.cancel(); speechSynthesis.speak(u)
}

type VocabQ = { id: string; question_text: string; correct_answer: string }
type QResult = { question: string; answer: string; userAnswer: string; correct: boolean }

export default function SpellingPracticePage() {
  const router = useRouter()
  const [screen, setScreen] = useState<'select' | 'quiz' | 'result'>('select')
  const [level, setLevel] = useState(0)
  const [questions, setQuestions] = useState<VocabQ[]>([])
  const [idx, setIdx] = useState(0)
  const [input, setInput] = useState('')
  const [checked, setChecked] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [results, setResults] = useState<QResult[]>([])
  const [loading, setLoading] = useState(false)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [levelCounts, setLevelCounts] = useState<Record<number, number>>({})
  const [userId, setUserId] = useState('')

  // レベルごとの問題数を取得
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data } = await supabase.from('questions').select('level').in('question_type', ['vocab_jp_en'])
      const counts: Record<number, number> = {}
      ;(data || []).forEach((q: any) => { counts[q.level] = (counts[q.level] || 0) + 1 })
      setLevelCounts(counts)
    }
    init()
  }, [router])

  const startQuiz = async (lv: number) => {
    setLoading(true)
    setLevel(lv)
    const { data } = await supabase.from('questions').select('id, question_text, correct_answer')
      .eq('level', lv).eq('question_type', 'vocab_jp_en').limit(100)
    const shuffled = shuffle(data || []) as VocabQ[]
    setQuestions(shuffled)
    setIdx(0); setInput(''); setChecked(false); setResults([])
    setStartedAt(new Date())
    setLoading(false)
    setScreen('quiz')
  }

  const check = () => {
    const q = questions[idx]
    const correct = isEnglishAnswerCorrect(input, q.correct_answer)
    setIsCorrect(correct)
    setChecked(true)
    if (correct) speak(q.correct_answer)
    setResults([...results, { question: q.question_text, answer: q.correct_answer, userAnswer: input.trim(), correct }])
  }

  const next = () => {
    if (idx + 1 >= questions.length) {
      // 学習記録に保存
      saveRecord()
      setScreen('result')
      return
    }
    setIdx(idx + 1); setInput(''); setChecked(false); setIsCorrect(false)
  }

  const saveRecord = async () => {
    if (!userId) return
    const correctCount = [...results].filter(r => r.correct).length + (isCorrect ? 1 : 0)
    try {
      const dur = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 1000) : 0
      await supabase.from('drill_records').insert({
        user_id: userId,
        drill_mode: 'spelling_practice',
        question_text: `レベル${level} スペル練習 (${questions.length}問)`,
        question_text_jp: '',
        correct_answer: '',
        question_type: 'vocab_jp_en',
        category: 'spelling_practice',
        correct_count: correctCount,
        total_count: questions.length,
        test_score: null,
        started_at: startedAt?.toISOString() || null,
        duration_seconds: dur,
      })
    } catch (e) { console.error('Failed to save:', e) }
  }

  const q = questions[idx]
  const correctCount = results.filter(r => r.correct).length

  // ─── レベル選択画面 ───
  if (screen === 'select') {
    const semesters = [
      { label: '1学期', levels: [1, 2, 3, 4, 5] },
      { label: '2学期', levels: [6, 7, 8, 9, 10] },
      { label: '3学期', levels: [11, 12, 13, 14, 15] },
    ]
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Keyboard size={22} className="text-indigo-500" />
              <h1 className="text-xl font-bold text-gray-800">スペル練習</h1>
            </div>
            <p className="text-sm text-gray-500">レベルを選んで、スペル練習をしましょう</p>
          </div>

          {semesters.map(sem => (
            <div key={sem.label} className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-700 mb-3">{sem.label}</h2>
              <div className="grid grid-cols-5 gap-2">
                {sem.levels.map(lv => {
                  const count = levelCounts[lv] || 0
                  const available = count >= 5
                  return (
                    <button key={lv} onClick={() => available && startQuiz(lv)} disabled={!available}
                      className={`p-3 rounded-xl text-center transition-all ${
                        available
                          ? 'bg-indigo-50 border-2 border-indigo-200 hover:border-indigo-400 hover:bg-indigo-100 active:scale-95'
                          : 'bg-gray-50 border-2 border-gray-100 opacity-50 cursor-not-allowed'
                      }`}>
                      <div className={`text-lg font-black ${available ? 'text-indigo-600' : 'text-gray-300'}`}>Lv.{lv}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{count}語</div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ─── クイズ画面 ───
  if (screen === 'quiz' && q) {
    const progressPct = ((idx + 1) / questions.length) * 100

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">

          {/* ヘッダー */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => {
                if (window.confirm('練習を中断しますか？')) setScreen('select')
              }} className="text-sm text-gray-500 flex items-center gap-1 hover:text-gray-700">
                <ArrowLeft size={14} />戻る
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-indigo-600">{idx + 1}/{questions.length}</span>
                <span className="text-xs bg-indigo-50 text-indigo-500 px-2 py-0.5 rounded-full">Lv.{level}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-sm font-bold text-emerald-600">{correctCount}</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* 問題カード */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1.5 bg-amber-400" />
            <div className="p-6">
              <p className="text-xs text-gray-500 mb-3 text-center">この日本語を英語のスペルで書きなさい</p>
              <p className="text-3xl font-bold text-gray-800 text-center mb-6">{q.question_text}</p>

              {!checked ? (
                <div>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && input.trim() && check()}
                    placeholder="英語のスペルを入力..."
                    autoFocus autoComplete="off"
                    className="w-full p-4 border-2 border-gray-200 rounded-xl text-xl text-center focus:border-indigo-500 focus:outline-none bg-gray-50 transition-all" />
                  <button onClick={check} disabled={!input.trim()}
                    className="w-full mt-3 py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-base font-bold disabled:opacity-40 transition-all active:scale-[0.98]">
                    チェック
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* 正誤表示 */}
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${isCorrect ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-red-50 border-2 border-red-200'}`}>
                    {isCorrect ? <CheckCircle size={24} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={24} className="text-red-500 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className={`text-lg font-bold ${isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isCorrect ? '正解！' : '不正解'}
                      </p>
                      {!isCorrect && (
                        <div className="mt-1">
                          <p className="text-sm text-gray-600">あなた: <span className="text-red-500 font-bold">{input}</span></p>
                          <p className="text-sm text-gray-600 mt-0.5">正答: <span className="text-indigo-600 font-bold text-lg">{q.correct_answer}</span></p>
                        </div>
                      )}
                      {isCorrect && <p className="text-lg font-bold text-indigo-600 mt-1">{q.correct_answer}</p>}
                    </div>
                  </div>

                  {/* 発音ボタン */}
                  <button onClick={() => speak(q.correct_answer)}
                    className="w-full py-3 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-2 transition-all">
                    <Volume2 size={18} className="text-indigo-500" />
                    <span className="text-sm font-medium text-indigo-600">発音を聞く</span>
                  </button>

                  {/* 次へボタン */}
                  <button onClick={next}
                    className="w-full py-3.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-base font-bold transition-all active:scale-[0.98]">
                    {idx + 1 >= questions.length ? '結果を見る' : '次へ →'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ミニ正誤グリッド */}
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <div className="flex flex-wrap gap-1">
              {questions.map((_, i) => (
                <div key={i} className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  i < results.length
                    ? results[i].correct ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                    : i === idx ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-400'
                }`}>{i + 1}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ─── 結果画面 ───
  if (screen === 'result') {
    const finalCorrect = results.filter(r => r.correct).length
    const pct = Math.round((finalCorrect / results.length) * 100)
    const wrongOnes = results.filter(r => !r.correct)

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">

          {/* スコアカード */}
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <Trophy size={48} className={`mx-auto mb-3 ${pct >= 80 ? 'text-amber-400' : pct >= 50 ? 'text-gray-400' : 'text-gray-300'}`} />
            <div className={`text-6xl font-black ${pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
              {finalCorrect}/{results.length}
            </div>
            <p className="text-gray-400 text-lg mt-1">正解率 {pct}%</p>
            <p className={`text-lg font-bold mt-2 ${pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {pct === 100 ? 'パーフェクト！' : pct >= 80 ? 'すばらしい！' : pct >= 50 ? 'もう少し！' : 'がんばろう！'}
            </p>
            <p className="text-xs text-gray-400 mt-1">レベル {level} ・ スペル練習</p>
          </div>

          {/* 間違えた単語 */}
          {wrongOnes.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <XCircle size={16} className="text-red-500" />
                間違えた単語 ({wrongOnes.length}語)
              </h3>
              <div className="space-y-2">
                {wrongOnes.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-800">{r.question}</p>
                      <p className="text-xs text-gray-500">あなた: <span className="text-red-500">{r.userAnswer}</span> → 正答: <span className="text-indigo-600 font-bold">{r.answer}</span></p>
                    </div>
                    <button onClick={() => speak(r.answer)} className="flex-shrink-0 p-2 rounded-full bg-indigo-50 hover:bg-indigo-100">
                      <Volume2 size={14} className="text-indigo-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 正解した単語 */}
          {results.filter(r => r.correct).length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" />
                正解した単語 ({results.filter(r => r.correct).length}語)
              </h3>
              <div className="flex flex-wrap gap-2">
                {results.filter(r => r.correct).map((r, i) => (
                  <button key={i} onClick={() => speak(r.answer)}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 flex items-center gap-1">
                    {r.answer}
                    <Volume2 size={12} className="text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex gap-3">
            <button onClick={() => startQuiz(level)}
              className="flex-1 py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-base font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2">
              <RotateCcw size={18} />
              もう一度
            </button>
            <button onClick={() => setScreen('select')}
              className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl text-base font-bold transition-all active:scale-[0.98] hover:bg-gray-50">
              レベル選択へ
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Keyboard size={40} className="text-indigo-400 mx-auto mb-3 animate-pulse" />
          <p className="text-indigo-600">単語を準備中...</p>
        </div>
      </div>
    )
  }

  return null
}
