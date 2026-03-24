'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { isJapaneseAnswerCorrect } from '@/lib/answer-check'
import { awardVocabPoints, checkAndAwardDailyBonuses, checkAndAwardStreakBonuses } from '@/lib/points'
import { showPointToast } from '@/components/PointToast'
import { Volume2, CheckCircle, XCircle, ArrowLeft, BookOpen, Trophy, RotateCcw } from 'lucide-react'

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
type QResult = { questionEn: string; answerJp: string; userAnswer: string; correct: boolean }



export default function VocabPracticePage() {
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

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      // vocab_jp_en を反転利用（英語を見せて日本語を答える）
      const { data } = await supabase.from('questions').select('level').eq('question_type', 'vocab_jp_en')
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
    // vocab_jp_en: question_text=日本語, correct_answer=英語 → 反転して英語を見せる
    const flipped = (data || []).map((q: any) => ({
      id: q.id,
      question_text: q.correct_answer, // 英語
      correct_answer: q.question_text,  // 日本語
    })) as VocabQ[]
    const shuffled = shuffle(flipped).slice(0, 20)
    setQuestions(shuffled)
    setIdx(0); setInput(''); setChecked(false); setResults([])
    setStartedAt(new Date())
    setLoading(false)
    setScreen('quiz')
  }

  const check = () => {
    const q = questions[idx]
    const correct = isJapaneseAnswerCorrect(input, q.correct_answer)
    setIsCorrect(correct)
    setChecked(true)
    speak(q.question_text)
    setResults([...results, { questionEn: q.question_text, answerJp: q.correct_answer, userAnswer: input.trim(), correct }])
  }

  const next = () => {
    if (idx + 1 >= questions.length) {
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
        drill_mode: 'vocab_practice',
        question_text: `レベル${level} 単語練習 (${questions.length}問)`,
        question_text_jp: '',
        correct_answer: '',
        question_type: 'vocab_en_jp',
        category: 'vocab_practice',
        correct_count: correctCount,
        total_count: questions.length,
        test_score: null,
        started_at: startedAt?.toISOString() || null,
        duration_seconds: dur,
      })
    } catch (e) { console.error('Failed to save:', e) }
    // ─── ポイント付与 ───
    try {
      const ptResults = await awardVocabPoints(level, correctCount, questions.length)
      ptResults.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type === 'vocab_complete' ? '単語練習完了' : 'レベルクリア！') })
      const dailyB = await checkAndAwardDailyBonuses()
      dailyB.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type) })
      const streakB = await checkAndAwardStreakBonuses()
      streakB.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type) })
    } catch (e) { console.error('Point award error:', e) }
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
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen size={22} className="text-emerald-500" />
              <h1 className="text-xl font-bold text-gray-800">単語練習</h1>
            </div>
            <p className="text-sm text-gray-500">英語を見て日本語の意味を答えましょう（20問）</p>
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
                          ? 'bg-emerald-50 border-2 border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100 active:scale-95'
                          : 'bg-gray-50 border-2 border-gray-100 opacity-50 cursor-not-allowed'
                      }`}>
                      <div className={`text-lg font-black ${available ? 'text-emerald-600' : 'text-gray-300'}`}>Lv.{lv}</div>
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
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">

          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <button onClick={() => {
                if (window.confirm('練習を中断しますか？')) setScreen('select')
              }} className="text-sm text-gray-500 flex items-center gap-1 hover:text-gray-700">
                <ArrowLeft size={14} />戻る
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-600">{idx + 1}/{questions.length}</span>
                <span className="text-xs bg-emerald-50 text-emerald-500 px-2 py-0.5 rounded-full">Lv.{level}</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-sm font-bold text-emerald-600">{correctCount}</span>
              </div>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="h-1.5 bg-emerald-400" />
            <div className="p-6">
              <p className="text-xs text-gray-500 mb-3 text-center">この英語の日本語の意味を書きなさい</p>
              <div className="text-center mb-6">
                <p className="text-3xl font-bold text-gray-800">{q.question_text}</p>
                <button onClick={() => speak(q.question_text)}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-600">
                  <Volume2 size={14} />発音
                </button>
              </div>

              {!checked ? (
                <div>
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && input.trim() && check()}
                    placeholder="日本語の意味を入力..."
                    autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
                    className="w-full p-4 border-2 border-gray-200 rounded-xl text-xl text-center focus:border-emerald-500 focus:outline-none bg-gray-50 transition-all" />
                  <button onClick={check} disabled={!input.trim()}
                    className="w-full mt-3 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-base font-bold disabled:opacity-40 transition-all active:scale-[0.98]">
                    チェック
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={`p-4 rounded-xl flex items-start gap-3 ${isCorrect ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-red-50 border-2 border-red-200'}`}>
                    {isCorrect ? <CheckCircle size={24} className="text-emerald-500 flex-shrink-0" /> : <XCircle size={24} className="text-red-500 flex-shrink-0" />}
                    <div className="flex-1">
                      <p className={`text-lg font-bold ${isCorrect ? 'text-emerald-600' : 'text-red-500'}`}>
                        {isCorrect ? '正解！' : '不正解'}
                      </p>
                      {!isCorrect && (
                        <div className="mt-1">
                          <p className="text-sm text-gray-600">あなた: <span className="text-red-500 font-bold">{input}</span></p>
                          <p className="text-sm text-gray-600 mt-0.5">正答: <span className="text-emerald-600 font-bold text-lg">{q.correct_answer}</span></p>
                        </div>
                      )}
                      {isCorrect && <p className="text-lg font-bold text-emerald-600 mt-1">{q.correct_answer}</p>}
                    </div>
                  </div>

                  <button onClick={() => speak(q.question_text)}
                    className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 rounded-xl flex items-center justify-center gap-2 transition-all">
                    <Volume2 size={18} className="text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">発音を聞く</span>
                  </button>

                  <button onClick={next}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-base font-bold transition-all active:scale-[0.98]">
                    {idx + 1 >= questions.length ? '結果を見る' : '次へ →'}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 shadow-sm">
            <div className="flex flex-wrap gap-1">
              {questions.map((_, i) => (
                <div key={i} className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold ${
                  i < results.length
                    ? results[i].correct ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-500'
                    : i === idx ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-400'
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
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 p-4 py-6">
        <div className="max-w-lg mx-auto space-y-4">

          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <Trophy size={48} className={`mx-auto mb-3 ${pct >= 80 ? 'text-amber-400' : pct >= 50 ? 'text-gray-400' : 'text-gray-300'}`} />
            <div className={`text-6xl font-black ${pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
              {finalCorrect}/{results.length}
            </div>
            <p className="text-gray-400 text-lg mt-1">正解率 {pct}%</p>
            <p className={`text-lg font-bold mt-2 ${pct >= 80 ? 'text-emerald-500' : pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
              {pct === 100 ? 'パーフェクト！' : pct >= 80 ? 'すばらしい！' : pct >= 50 ? 'もう少し！' : 'がんばろう！'}
            </p>
            <p className="text-xs text-gray-400 mt-1">レベル {level} ・ 単語練習</p>
          </div>

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
                      <p className="text-sm font-bold text-gray-800">{r.questionEn}</p>
                      <p className="text-xs text-gray-500">あなた: <span className="text-red-500">{r.userAnswer}</span> → 正答: <span className="text-emerald-600 font-bold">{r.answerJp}</span></p>
                    </div>
                    <button onClick={() => speak(r.questionEn)} className="flex-shrink-0 p-2 rounded-full bg-emerald-50 hover:bg-emerald-100">
                      <Volume2 size={14} className="text-emerald-500" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.filter(r => r.correct).length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle size={16} className="text-emerald-500" />
                正解した単語 ({results.filter(r => r.correct).length}語)
              </h3>
              <div className="flex flex-wrap gap-2">
                {results.filter(r => r.correct).map((r, i) => (
                  <button key={i} onClick={() => speak(r.questionEn)}
                    className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 hover:bg-emerald-100 flex items-center gap-1">
                    {r.questionEn} = {r.answerJp}
                    <Volume2 size={12} className="text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => startQuiz(level)}
              className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl text-base font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-2">
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
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="text-center">
          <BookOpen size={40} className="text-emerald-400 mx-auto mb-3 animate-pulse" />
          <p className="text-emerald-600">単語を準備中...</p>
        </div>
      </div>
    )
  }

  return null
}
