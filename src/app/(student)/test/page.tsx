'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { awardTestPoints, checkAndAwardDailyBonuses, checkAndAwardStreakBonuses } from '@/lib/points'
import { showPointToast } from '@/components/PointToast'

// ─── 設定 ───
const Q_DIST = { multiple_choice: 8, fill_blank: 7, vocab: 6, writing: 4 }
const PASS_SCORE = 80
const MAX_LEVEL = 15
const CAT_LABEL: Record<string, string> = { be_verb: 'be動詞', self_intro: '自己紹介', things_around: '身の回り' }
const SKILL_LABEL: Record<string, string> = { grammar: '文法', vocabulary: '語彙', writing: '作文' }
const TYPE_LABEL: Record<string, string> = { multiple_choice: '選択', fill_blank: '穴埋め', vocab_jp_en: '日→英', vocab_en_jp: '英→日', writing: '作文' }
const SEMESTER_LABEL: Record<string, string> = { '1': '1学期', '2': '2学期', '3': '3学期' }

function getSemester(level: number): string {
  if (level <= 5) return '1'
  if (level <= 10) return '2'
  return '3'
}

function getSemesterRange(level: number): string {
  if (level <= 5) return 'Lv.1〜5（1学期）'
  if (level <= 10) return 'Lv.6〜10（2学期）'
  return 'Lv.11〜15（3学期）'
}

type Question = {
  id: string; level: number; category: string; question_type: string; skill_tag: string;
  points: number; question_text: string; question_text_jp: string | null;
  options: string[] | null; correct_answer: string | null; acceptable_answers: string[] | null;
  explanation_jp: string | null;
}

type AnswerResult = {
  question_id: string; session_id: string; user_answer: string; is_correct: boolean;
  score: number; max_score: number; ai_feedback: string; category: string;
  skill_tag: string; question_type: string;
}

type WeaknessItem = { key: string; label: string; pct: number; earned: number; total: number }
type Analysis = { byCategory: WeaknessItem[]; bySkill: WeaknessItem[]; weakest: WeaknessItem[] }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function selectQuestions(all: Question[]): Question[] {
  const mc = shuffle(all.filter(q => q.question_type === 'multiple_choice')).slice(0, Q_DIST.multiple_choice)
  const fb = shuffle(all.filter(q => q.question_type === 'fill_blank')).slice(0, Q_DIST.fill_blank)
  const vocabPool = shuffle([
    ...all.filter(q => q.question_type === 'vocab_jp_en'),
    ...all.filter(q => q.question_type === 'vocab_en_jp'),
  ])
  const vocab = vocabPool.slice(0, Q_DIST.vocab)
  const wr = shuffle(all.filter(q => q.question_type === 'writing')).slice(0, Q_DIST.writing)
  return [...shuffle(mc), ...shuffle(fb), ...shuffle(vocab), ...shuffle(wr)]
}

function autoGrade(q: Question, answer: string): { correct: boolean; score: number } {
  if (!answer?.trim()) return { correct: false, score: 0 }
  const ua = answer.trim().toLowerCase()
  const ca = (q.correct_answer || '').trim().toLowerCase()
  if (ua === ca) return { correct: true, score: q.points }
  const alts: string[] = q.acceptable_answers || []
  for (const alt of alts) {
    if (ua === alt.toLowerCase()) return { correct: true, score: q.points }
  }
  return { correct: false, score: 0 }
}

function analyzeWeakness(answers: AnswerResult[]): Analysis {
  const byCat: Record<string, { total: number; earned: number }> = {}
  const bySk: Record<string, { total: number; earned: number }> = {}
  for (const a of answers) {
    if (!byCat[a.category]) byCat[a.category] = { total: 0, earned: 0 }
    if (!bySk[a.skill_tag]) bySk[a.skill_tag] = { total: 0, earned: 0 }
    byCat[a.category].total += a.max_score
    byCat[a.category].earned += a.score
    bySk[a.skill_tag].total += a.max_score
    bySk[a.skill_tag].earned += a.score
  }
  const catR = Object.entries(byCat).map(([k, v]) => ({
    key: k, label: CAT_LABEL[k] || k, pct: v.total > 0 ? Math.round((v.earned / v.total) * 100) : 0, earned: v.earned, total: v.total,
  }))
  const skR = Object.entries(bySk).map(([k, v]) => ({
    key: k, label: SKILL_LABEL[k] || k, pct: v.total > 0 ? Math.round((v.earned / v.total) * 100) : 0, earned: v.earned, total: v.total,
  }))
  const weakest = [...catR, ...skR].sort((a, b) => a.pct - b.pct).slice(0, 3)
  return { byCategory: catR, bySkill: skR, weakest }
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function pctColor(pct: number): string {
  if (pct >= 80) return 'text-emerald-500'
  if (pct >= 50) return 'text-amber-500'
  return 'text-red-500'
}

function pctBg(pct: number): string {
  if (pct >= 80) return 'bg-emerald-400'
  if (pct >= 50) return 'bg-amber-400'
  return 'bg-red-400'
}

type Screen = 'loading' | 'ready' | 'test' | 'grading' | 'results'

export default function TestPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('loading')
  const [userId, setUserId] = useState('')
  const [progress, setProgress] = useState<any>(null)
  const [history, setHistory] = useState<any[]>([])
  const [testQuestions, setTestQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [sessionId, setSessionId] = useState('')
  const [testResult, setTestResult] = useState<{ score: number; passed: boolean; answers: AnswerResult[]; analysis: Analysis; elapsed: number } | null>(null)
  const [gradingMsg, setGradingMsg] = useState('')
  const [error, setError] = useState('')
  const [aiAdvice, setAiAdvice] = useState('')

  // Timer
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (screen === 'test') {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000)
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [screen])

  // 初期ロード
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserId(user.id)
      const { data: pArr } = await supabase.from('user_progress').select('*').eq('user_id', user.id)
      if (pArr && pArr.length > 0) {
        setProgress(pArr[0])
      } else {
        const { data: created } = await supabase.from('user_progress').insert({ user_id: user.id, current_level: 1, total_tests_taken: 0, highest_score: 0, weakness_data: {} }).select()
        if (created?.[0]) setProgress(created[0])
      }
      const { data: hist } = await supabase.from('test_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }).limit(20)
      setHistory(hist || [])
      setScreen('ready')
    }
    init()
  }, [router])

  const startTest = async () => {
    setError('')
    const level = progress?.current_level || 1
    const { data: allQ, error: qErr } = await supabase.from('questions').select('*').eq('level', level)
    if (qErr || !allQ || allQ.length < 25) {
      setError(`レベル${level}の問題が不足（${allQ?.length || 0}問）。最低25問必要です。`)
      return
    }
    const selected = selectQuestions(allQ as Question[])
    setTestQuestions(selected)
    setAnswers({})
    setCurrentQ(0)
    setTestResult(null)
    setAiAdvice('')
    const { data: session } = await supabase.from('test_sessions').insert({ user_id: userId, level }).select()
    if (session?.[0]) setSessionId(session[0].id)
    setScreen('test')
  }

  const submitTest = async () => {
    const finalElapsed = elapsed
    setScreen('grading')
    const results: AnswerResult[] = []
    let totalScore = 0

    for (let i = 0; i < testQuestions.length; i++) {
      const q = testQuestions[i]
      const ua = answers[i] || ''
      if (q.question_type === 'writing') {
        setGradingMsg(`AI採点中... (${i + 1}/${testQuestions.length})`)
        try {
          const res = await fetch('/api/grade-writing', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: q.question_text, questionJp: q.question_text_jp, answer: ua, maxPoints: q.points }),
          })
          const ai = await res.json()
          const r: AnswerResult = {
            question_id: q.id, session_id: sessionId, user_answer: ua,
            is_correct: ai.score >= q.points * 0.6, score: ai.score, max_score: q.points,
            ai_feedback: ai.feedback, category: q.category, skill_tag: q.skill_tag, question_type: q.question_type,
          }
          totalScore += r.score
          results.push(r)
        } catch {
          results.push({ question_id: q.id, session_id: sessionId, user_answer: ua, is_correct: false, score: 0, max_score: q.points, ai_feedback: 'AI採点エラー', category: q.category, skill_tag: q.skill_tag, question_type: q.question_type })
        }
      } else {
        setGradingMsg(`採点中... (${i + 1}/${testQuestions.length})`)
        const grade = autoGrade(q, ua)
        let feedback = '正解！よくできました！'
        if (!grade.correct) {
          if (!ua.trim()) {
            feedback = `未回答です。正答は「${q.correct_answer}」です。${q.explanation_jp || ''}`
          } else if (q.question_type === 'multiple_choice') {
            feedback = `「${ua}」ではなく「${q.correct_answer}」が正解です。${q.explanation_jp || ''}`
          } else if (q.question_type === 'fill_blank') {
            const fullSentence = q.question_text.replace('___', q.correct_answer || '')
            feedback = `正答は「${q.correct_answer}」です。完成文: 「${fullSentence}」 ${q.explanation_jp || ''}`
          } else if (q.question_type === 'vocab_jp_en') {
            feedback = `「${q.question_text}」の英語は「${q.correct_answer}」です。スペルに注意しましょう。`
          } else if (q.question_type === 'vocab_en_jp') {
            const alts = q.acceptable_answers?.join('、') || ''
            feedback = `「${q.question_text}」の意味は「${q.correct_answer}」です。${alts ? `（${alts} でもOK）` : ''}`
          } else {
            feedback = `不正解。正答: ${q.correct_answer} ${q.explanation_jp || ''}`
          }
        }
        const r: AnswerResult = {
          question_id: q.id, session_id: sessionId, user_answer: ua,
          is_correct: grade.correct, score: grade.score, max_score: q.points,
          ai_feedback: feedback,
          category: q.category, skill_tag: q.skill_tag, question_type: q.question_type,
        }
        totalScore += r.score
        results.push(r)
      }
    }

    await supabase.from('test_answers').insert(results).select()
    const analysis = analyzeWeakness(results)
    const passed = totalScore >= PASS_SCORE

    await supabase.from('test_sessions').update({
      total_score: totalScore, passed, completed_at: new Date().toISOString(), weakness_analysis: analysis,
    }).eq('id', sessionId)

    // ─── ポイント付与 ───
    const ptResults = await awardTestPoints(sessionId, totalScore)
    ptResults.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type === 'test_complete' ? 'テスト受験' : 'スコアボーナス') })
    const dailyB = await checkAndAwardDailyBonuses()
    dailyB.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type) })
    const streakB = await checkAndAwardStreakBonuses()
    streakB.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type) })

    const updates: any = {
      total_tests_taken: (progress?.total_tests_taken || 0) + 1,
      highest_score: Math.max(progress?.highest_score || 0, totalScore),
      weakness_data: analysis, updated_at: new Date().toISOString(),
    }
    if (passed && (progress?.current_level || 1) < MAX_LEVEL) {
      updates.current_level = (progress?.current_level || 1) + 1
    }
    await supabase.from('user_progress').update(updates).eq('user_id', userId)
    setProgress({ ...progress, ...updates })

    const { data: hist } = await supabase.from('test_sessions').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(20)
    setHistory(hist || [])

    setTestResult({ score: totalScore, passed, answers: results, analysis, elapsed: finalElapsed })
    setScreen('results')

    // AI advice (non-blocking)
    fetch('/api/test-advice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: totalScore, analysis, level: progress?.current_level || 1,
        wrongAnswers: results.filter(r => !r.is_correct).map((r, i) => ({
          question: testQuestions[results.indexOf(r)]?.question_text,
          type: r.question_type, category: r.category,
          answer: r.user_answer, correct: testQuestions[results.indexOf(r)]?.correct_answer,
        })),
      }),
    }).then(r => r.json()).then(d => setAiAdvice(d.advice || '')).catch(() => {})
  }

  // ─── LOADING ───
  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center"><div className="text-5xl mb-4 animate-bounce">📝</div><p className="text-indigo-600 font-medium">読み込み中...</p></div>
      </div>
    )
  }

  // ─── DASHBOARD ───
  if (screen === 'ready') {
    const level = progress?.current_level || 1
    const semester = getSemester(level)
    const semesterLevels = semester === '1' ? [1,2,3,4,5] : semester === '2' ? [6,7,8,9,10] : [11,12,13,14,15]

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* ヘッダー */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-gray-800">📝 実力テスト</h1>
                <p className="text-gray-400 text-sm mt-1">25問 ・ 100点満点 ・ 80点で次のレベルへ</p>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-400">{SEMESTER_LABEL[semester]}</div>
                <div className="text-xs text-indigo-500 font-medium">{getSemesterRange(level)}</div>
              </div>
            </div>
          </div>

          {/* レベルカード */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl p-6 text-white relative overflow-hidden">
            <div className="absolute top-[-20px] right-[-20px] w-28 h-28 rounded-full bg-white/10" />
            <div className="absolute bottom-[-10px] left-[-10px] w-20 h-20 rounded-full bg-white/5" />
            <div className="relative">
              <p className="text-sm opacity-90">現在のレベル</p>
              <div className="flex items-baseline gap-3 mt-1">
                <span className="text-5xl font-black">{level}</span>
                <span className="text-lg opacity-80">/ {MAX_LEVEL}</span>
              </div>
              <div className="flex gap-4 mt-3 text-sm opacity-90">
                <span>受験: {progress?.total_tests_taken || 0}回</span>
                <span>最高: {progress?.highest_score || 0}点</span>
              </div>
              {/* 学期内レベル進捗 */}
              <div className="flex gap-1 mt-4">
                {semesterLevels.map(lv => (
                  <div key={lv} className={`flex-1 h-2 rounded-full transition-all ${lv <= level ? 'bg-white' : 'bg-white/20'}`} />
                ))}
              </div>
              <p className="text-xs opacity-70 mt-1">{SEMESTER_LABEL[semester]} 進捗: {level - semesterLevels[0] + 1}/5</p>
            </div>
          </div>

          {/* テスト開始 */}
          <button onClick={startTest}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-2xl text-lg font-bold transition-all shadow-sm shadow-emerald-200">
            🚀 テスト開始（レベル {level}）
          </button>
          {error && <p className="text-red-500 text-sm text-center bg-red-50 p-3 rounded-xl">{error}</p>}

          {/* スコア推移グラフ */}
          {history.length > 1 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4">📈 スコア推移</h2>
              <div className="flex items-end gap-1 h-32">
                {[...history].reverse().slice(-10).map((h: any, i: number) => {
                  const pct = (h.total_score / 100) * 100
                  return (
                    <div key={h.id} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-400 font-medium">{h.total_score}</span>
                      <div className="w-full rounded-t-md relative" style={{ height: `${Math.max(pct, 4)}%` }}>
                        <div className={`absolute inset-0 rounded-t-md ${h.passed ? 'bg-emerald-400' : h.total_score >= 60 ? 'bg-amber-400' : 'bg-red-300'}`} />
                      </div>
                    </div>
                  )
                })}
              </div>
              {/* 80点ライン */}
              <div className="relative h-0 -mt-[25.6px]">
                <div className="border-t-2 border-dashed border-indigo-300 w-full" />
                <span className="absolute right-0 -top-4 text-[10px] text-indigo-400">80点</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-300 mt-3">
                <span>過去</span><span>最新</span>
              </div>
            </div>
          )}

          {/* スキル分析 */}
          {progress?.weakness_data?.bySkill?.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4">📊 スキル分析</h2>
              {progress.weakness_data.bySkill.map((sk: WeaknessItem) => (
                <div key={sk.key} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{sk.label}</span>
                    <span className={`font-bold ${pctColor(sk.pct)}`}>{sk.pct}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all duration-500 ${pctBg(sk.pct)}`} style={{ width: `${sk.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* カテゴリ分析 */}
          {progress?.weakness_data?.byCategory?.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-4">🏷️ カテゴリ分析</h2>
              <div className="grid grid-cols-3 gap-3">
                {progress.weakness_data.byCategory.map((cat: WeaknessItem) => (
                  <div key={cat.key} className="text-center p-3 bg-gray-50 rounded-xl">
                    <div className={`text-2xl font-black ${pctColor(cat.pct)}`}>{cat.pct}%</div>
                    <div className="text-xs text-gray-500 mt-1">{cat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 弱点アラート */}
          {progress?.weakness_data?.weakest?.filter((w: WeaknessItem) => w.pct < 70).length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
              <h2 className="font-bold text-red-700 mb-2">⚠️ 弱点ポイント</h2>
              {progress.weakness_data.weakest.filter((w: WeaknessItem) => w.pct < 70).map((w: WeaknessItem, i: number) => (
                <p key={i} className="text-sm text-gray-600 mb-1">
                  • <strong className="text-gray-800">{w.label}</strong>（{w.pct}%）— もっと練習しよう！
                </p>
              ))}
            </div>
          )}

          {/* 履歴 */}
          {history.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-3">📋 テスト履歴</h2>
              {history.slice(0, 8).map((h: any) => (
                <div key={h.id} className="flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0">
                  <span className="text-xs text-gray-400 w-20">{new Date(h.started_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}</span>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Lv.{h.level}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-gray-100 rounded-full">
                      <div className={`h-1.5 rounded-full ${h.passed ? 'bg-emerald-400' : h.total_score >= 60 ? 'bg-amber-400' : 'bg-red-300'}`}
                        style={{ width: `${h.total_score}%` }} />
                    </div>
                    <span className={`text-sm font-bold w-10 text-right ${h.passed ? 'text-emerald-500' : 'text-gray-600'}`}>
                      {h.total_score}
                    </span>
                    {h.passed && <span className="text-xs">✅</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 全レベル進捗 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-3">🎯 全レベル進捗</h2>
            {['1学期', '2学期', '3学期'].map((sem, si) => {
              const levels = si === 0 ? [1,2,3,4,5] : si === 1 ? [6,7,8,9,10] : [11,12,13,14,15]
              return (
                <div key={sem} className="mb-3">
                  <p className="text-xs text-gray-400 mb-1.5">{sem}</p>
                  <div className="flex gap-1">
                    {levels.map(lv => (
                      <div key={lv} className={`flex-1 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all ${
                        lv < level ? 'bg-emerald-100 text-emerald-600' :
                        lv === level ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm' :
                        'bg-gray-100 text-gray-300'
                      }`}>
                        {lv}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
            <p className="text-center text-xs text-gray-400 mt-2">80点以上で次のレベルへ！</p>
          </div>
        </div>
      </div>
    )
  }

  // ─── テスト画面 ───
  if (screen === 'test') {
    const q = testQuestions[currentQ]
    if (!q) return null
    const answeredCount = Object.keys(answers).length
    const isVocab = q.question_type === 'vocab_jp_en' || q.question_type === 'vocab_en_jp'
    const opts: string[] = q.options && typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || [])
    const progressPct = ((currentQ + 1) / testQuestions.length) * 100

    // セクションラベル
    let sectionLabel = ''
    if (currentQ < Q_DIST.multiple_choice) sectionLabel = '📋 選択問題'
    else if (currentQ < Q_DIST.multiple_choice + Q_DIST.fill_blank) sectionLabel = '✏️ 穴埋め問題'
    else if (currentQ < Q_DIST.multiple_choice + Q_DIST.fill_blank + Q_DIST.vocab) sectionLabel = '📚 単語問題'
    else sectionLabel = '📝 作文問題'

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
        <div className="max-w-2xl mx-auto space-y-3">

          {/* ヘッダーバー */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-indigo-600">{currentQ + 1}/{testQuestions.length}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{sectionLabel}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{answeredCount}問回答済</span>
                <div className="flex items-center gap-1.5 bg-indigo-50 px-3 py-1 rounded-full">
                  <span className="text-xs">⏱</span>
                  <span className="text-sm font-mono font-bold text-indigo-600">{formatTime(elapsed)}</span>
                </div>
              </div>
            </div>
            {/* プログレスバー */}
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          {/* 問題番号グリッド */}
          <div className="bg-white rounded-xl p-3 shadow-sm">
            <div className="flex flex-wrap gap-1">
              {testQuestions.map((_, i) => (
                <button key={i} onClick={() => setCurrentQ(i)}
                  className={`w-7 h-7 rounded-md text-xs font-bold transition-all ${
                    i === currentQ ? 'bg-indigo-500 text-white scale-110 shadow-sm' :
                    answers[i] !== undefined ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' :
                    'bg-gray-50 text-gray-400 border border-gray-200 hover:bg-gray-100'
                  }`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* 問題カード */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* カード上部のカラーバー */}
            <div className={`h-1.5 ${
              q.question_type === 'multiple_choice' ? 'bg-indigo-400' :
              q.question_type === 'fill_blank' ? 'bg-teal-400' :
              isVocab ? 'bg-amber-400' : 'bg-purple-400'
            }`} />

            <div className="p-6">
              {/* タグ */}
              <div className="flex gap-2 mb-4 flex-wrap">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  q.question_type === 'multiple_choice' ? 'bg-indigo-50 text-indigo-600' :
                  q.question_type === 'fill_blank' ? 'bg-teal-50 text-teal-600' :
                  isVocab ? 'bg-amber-50 text-amber-600' : 'bg-purple-50 text-purple-600'
                }`}>
                  {TYPE_LABEL[q.question_type] || q.question_type}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
                  {CAT_LABEL[q.category] || q.category}
                </span>
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-500">
                  {q.points}点
                </span>
              </div>

              {/* 日本語指示 */}
              {q.question_text_jp && (
                <p className="text-sm text-gray-600 mb-2 leading-relaxed">{q.question_text_jp}</p>
              )}

              {/* 問題文 + 発音 */}
              <div className="flex items-start gap-3 mb-6">
                <p className="text-xl font-bold text-gray-800 leading-relaxed">{q.question_text}</p>
                {/[a-zA-Z]{2,}/.test(q.question_text) && (
                  <button onClick={() => {
                    let speakText = q.question_text.replace(/___+/g, q.correct_answer || 'blank')
                    const u = new SpeechSynthesisUtterance(speakText)
                    u.lang = 'en-US'; u.rate = 0.85
                    speechSynthesis.cancel()
                    speechSynthesis.speak(u)
                  }}
                    className="flex-shrink-0 mt-1 w-9 h-9 flex items-center justify-center rounded-full bg-indigo-50 hover:bg-indigo-100 active:scale-95 transition-all"
                    title="発音を聞く">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                    </svg>
                  </button>
                )}
              </div>

              {/* 選択肢 */}
              {q.question_type === 'multiple_choice' && opts.length > 0 && (
                <div className="space-y-2.5">
                  {opts.map((opt, oi) => {
                    const selected = answers[currentQ] === opt
                    return (
                      <button key={oi} onClick={() => setAnswers({ ...answers, [currentQ]: opt })}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all text-base group ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm shadow-indigo-100'
                            : 'border-gray-200 bg-gray-50 text-gray-700 hover:border-indigo-200 hover:bg-indigo-50/50'
                        }`}>
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full mr-3 text-sm font-bold ${
                          selected ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500 group-hover:bg-indigo-100'
                        }`}>
                          {String.fromCharCode(65 + oi)}
                        </span>
                        {opt}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* テキスト入力 */}
              {(q.question_type === 'fill_blank' || isVocab) && (
                <input value={answers[currentQ] || ''} onChange={e => setAnswers({ ...answers, [currentQ]: e.target.value })}
                  placeholder={isVocab ? (q.question_type === 'vocab_jp_en' ? '英語で入力...' : '日本語で入力...') : '答えを入力...'}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl text-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 focus:outline-none bg-gray-50 transition-all"
                  autoComplete="off" autoFocus />
              )}

              {/* 作文 */}
              {q.question_type === 'writing' && (
                <textarea value={answers[currentQ] || ''} onChange={e => setAnswers({ ...answers, [currentQ]: e.target.value })}
                  placeholder="英語で文を書きなさい..."
                  rows={5}
                  className="w-full p-4 border-2 border-gray-200 rounded-xl text-base focus:border-purple-500 focus:ring-2 focus:ring-purple-100 focus:outline-none bg-gray-50 transition-all resize-y leading-relaxed"
                  autoFocus />
              )}
            </div>
          </div>

          {/* ナビゲーション */}
          <div className="flex gap-3">
            <button onClick={() => setCurrentQ(Math.max(0, currentQ - 1))} disabled={currentQ === 0}
              className={`flex-1 py-3.5 rounded-xl text-base font-semibold transition-all ${
                currentQ === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 active:scale-[0.98]'
              }`}>
              ← 前へ
            </button>
            {currentQ < testQuestions.length - 1 ? (
              <button onClick={() => setCurrentQ(currentQ + 1)}
                className="flex-1 py-3.5 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] text-white rounded-xl text-base font-semibold transition-all">
                次へ →
              </button>
            ) : (
              <button onClick={() => {
                const unanswered = testQuestions.length - answeredCount
                const msg = unanswered > 0
                  ? `未回答が${unanswered}問あります。提出しますか？`
                  : `全問回答済みです。提出しますか？`
                if (window.confirm(msg)) submitTest()
              }}
                className="flex-1 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-xl text-base font-bold transition-all shadow-sm shadow-emerald-200">
                📤 提出する
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── 採点中 ───
  if (screen === 'grading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center bg-white rounded-3xl p-10 shadow-sm max-w-xs mx-auto">
          <div className="text-6xl mb-5 animate-bounce">📊</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">採点中...</h2>
          <p className="text-gray-400 text-sm mb-4">{gradingMsg}</p>
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-2 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full animate-pulse" style={{ width: '60%' }} />
          </div>
        </div>
      </div>
    )
  }

  // ─── 結果画面 ───
  if (screen === 'results' && testResult) {
    const { score, passed, answers: rAnswers, analysis, elapsed: testTime } = testResult
    const correctCount = rAnswers.filter(a => a.is_correct).length
    const level = progress?.current_level || 1

    // 問題タイプ別集計
    const byType: Record<string, { correct: number; total: number; earned: number; max: number }> = {}
    rAnswers.forEach((a, i) => {
      const t = a.question_type
      if (!byType[t]) byType[t] = { correct: 0, total: 0, earned: 0, max: 0 }
      byType[t].total++
      byType[t].max += a.max_score
      byType[t].earned += a.score
      if (a.is_correct) byType[t].correct++
    })

    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* スコアヒーロー */}
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center relative overflow-hidden">
            {passed && (
              <div className="absolute inset-0 bg-gradient-to-b from-emerald-50 to-transparent" />
            )}
            <div className="relative">
              <div className="text-6xl mb-3">{passed ? '🎉' : score >= 60 ? '💪' : '📚'}</div>
              <div className={`text-7xl font-black ${passed ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-red-400'}`}>
                {score}
              </div>
              <p className="text-gray-400 text-lg mt-1">/ 100点</p>
              <p className={`text-xl font-bold mt-3 ${passed ? 'text-emerald-500' : 'text-amber-500'}`}>
                {passed ? `合格！🎊 レベル${level}に昇格！` : 'もう少し！80点以上で合格です'}
              </p>

              {/* サマリー統計 */}
              <div className="flex justify-center gap-6 mt-5">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">{correctCount}</div>
                  <div className="text-xs text-gray-400">正解数</div>
                </div>
                <div className="w-px bg-gray-200" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">{testQuestions.length - correctCount}</div>
                  <div className="text-xs text-gray-400">不正解</div>
                </div>
                <div className="w-px bg-gray-200" />
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-700">{formatTime(testTime)}</div>
                  <div className="text-xs text-gray-400">所要時間</div>
                </div>
              </div>
            </div>
          </div>

          {/* AIアドバイス */}
          {aiAdvice && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-2xl p-5">
              <h3 className="font-bold text-indigo-700 mb-2">🤖 AIアドバイス</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{aiAdvice}</p>
            </div>
          )}
          {!aiAdvice && (
            <div className="bg-gray-50 rounded-2xl p-4 text-center">
              <p className="text-sm text-gray-400 animate-pulse">🤖 AIがアドバイスを生成中...</p>
            </div>
          )}

          {/* 問題タイプ別成績 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">📊 問題タイプ別</h3>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(byType).map(([type, data]) => {
                const pct = data.max > 0 ? Math.round((data.earned / data.max) * 100) : 0
                return (
                  <div key={type} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">{TYPE_LABEL[type]}</span>
                      <span className={`text-sm font-bold ${pctColor(pct)}`}>{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full">
                      <div className={`h-1.5 rounded-full ${pctBg(pct)}`} style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1">{data.correct}/{data.total}問正解 ({data.earned}/{data.max}点)</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* カテゴリ別 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">🏷️ カテゴリ別成績</h3>
            {analysis.byCategory.map(cat => (
              <div key={cat.key} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{cat.label}</span>
                  <span className={`font-bold ${pctColor(cat.pct)}`}>{cat.pct}% ({cat.earned}/{cat.total})</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all duration-500 ${pctBg(cat.pct)}`} style={{ width: `${cat.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* スキル別 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">🎯 スキル別成績</h3>
            {analysis.bySkill.map(sk => (
              <div key={sk.key} className="mb-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">{sk.label}</span>
                  <span className={`font-bold ${pctColor(sk.pct)}`}>{sk.pct}% ({sk.earned}/{sk.total})</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2.5">
                  <div className={`h-2.5 rounded-full transition-all duration-500 ${pctBg(sk.pct)}`} style={{ width: `${sk.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          {/* 弱点 */}
          {analysis.weakest.filter(w => w.pct < 80).length > 0 && (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
              <h3 className="font-bold text-red-700 mb-2">⚠️ 重点復習ポイント</h3>
              {analysis.weakest.filter(w => w.pct < 80).map((w, i) => (
                <p key={i} className="text-sm text-gray-600 mb-1">
                  • <strong className="text-gray-800">{w.label}</strong>（{w.pct}%）— もっと練習しよう！
                </p>
              ))}
            </div>
          )}

          {/* 問題別詳細 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-4">📝 問題別結果</h3>
            {rAnswers.map((a, i) => {
              const q = testQuestions[i]
              const hasEnglish = q && /[a-zA-Z]{2,}/.test(q.question_text)
              return (
                <div key={i} className={`py-4 border-b border-gray-100 last:border-0 ${!a.is_correct ? 'bg-red-50/50 -mx-2 px-2 rounded-lg' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-lg">{a.is_correct ? '✅' : '❌'}</span>
                      <span className="text-sm font-bold text-gray-800">問{i + 1}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        a.question_type === 'multiple_choice' ? 'bg-indigo-50 text-indigo-600' :
                        a.question_type === 'fill_blank' ? 'bg-teal-50 text-teal-600' :
                        a.question_type === 'writing' ? 'bg-purple-50 text-purple-600' :
                        'bg-amber-50 text-amber-600'
                      }`}>{TYPE_LABEL[a.question_type]}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-gray-100 text-gray-600">
                        {CAT_LABEL[a.category] || a.category}
                      </span>
                    </div>
                    <span className={`text-sm font-bold ${a.score > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{a.score}/{a.max_score}</span>
                  </div>
                  {/* 日本語指示文 */}
                  {q?.question_text_jp && (
                    <p className="text-sm text-gray-600 mb-1">{q.question_text_jp}</p>
                  )}
                  {/* 英語問題文 + スピーカー */}
                  <div className="flex items-start gap-2 mb-2">
                    <p className="text-base font-semibold text-gray-800 leading-relaxed">{q?.question_text}</p>
                    {hasEnglish && (
                      <button onClick={() => {
                        let speakText = (q?.question_text || '').replace(/___+/g, q?.correct_answer || 'blank')
                        const u = new SpeechSynthesisUtterance(speakText)
                        u.lang = 'en-US'; u.rate = 0.85
                        speechSynthesis.cancel()
                        speechSynthesis.speak(u)
                      }}
                        className="flex-shrink-0 mt-0.5 w-7 h-7 flex items-center justify-center rounded-full bg-indigo-50 hover:bg-indigo-100 transition-colors"
                        title="発音を聞く">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                          <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                        </svg>
                      </button>
                    )}
                  </div>
                  {/* 回答 */}
                  {a.user_answer ? (
                    <p className="text-sm text-gray-700">回答: <span className={`font-bold ${a.is_correct ? 'text-emerald-600' : 'text-red-500'}`}>{a.user_answer}</span></p>
                  ) : (
                    <p className="text-sm text-gray-400 italic">未回答</p>
                  )}
                  {/* フィードバック */}
                  {a.ai_feedback && <p className="text-sm text-gray-600 mt-1">{a.ai_feedback}</p>}
                  {q?.explanation_jp && !a.is_correct && (
                    <div className="mt-2 bg-indigo-50 rounded-lg p-2.5">
                      <p className="text-sm text-indigo-700">💡 {q.explanation_jp}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* 復習ノートドリル */}
          {rAnswers.filter(a => !a.is_correct).length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm border-2 border-amber-200">
              <h3 className="font-bold text-amber-700 mb-2">📒 復習ノートドリル</h3>
              <p className="text-sm text-gray-600 mb-4">
                間違えた問題をノートに書いて復習しましょう！声に出しながら3回ずつ書くと効果的です。
              </p>

              <div className="space-y-4">
                {rAnswers.map((a, i) => {
                  if (a.is_correct) return null
                  const q = testQuestions[i]
                  if (!q) return null

                  const isVocab = q.question_type === 'vocab_jp_en' || q.question_type === 'vocab_en_jp'
                  const isFill = q.question_type === 'fill_blank'
                  const isMC = q.question_type === 'multiple_choice'
                  const completeSentence = isFill || isMC ? q.question_text.replace(/___+/g, q.correct_answer || '') : null

                  return (
                    <div key={i} className="bg-amber-50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">問{i + 1}</span>
                        <span className="text-xs text-amber-600">{TYPE_LABEL[a.question_type]}</span>
                      </div>

                      {isVocab && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700">
                            <span className="font-bold">{q.question_text}</span> = <span className="font-bold text-indigo-700">{q.correct_answer}</span>
                          </p>
                          <div className="bg-white rounded-lg p-3 border border-amber-200">
                            <p className="text-xs text-amber-600 mb-1">ノートに3回書こう:</p>
                            <p className="text-lg text-gray-300 font-mono tracking-widest">
                              {q.correct_answer} ・ {q.correct_answer} ・ {q.correct_answer}
                            </p>
                          </div>
                        </div>
                      )}

                      {(isFill || isMC) && completeSentence && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700">
                            正しい文: <span className="font-bold text-indigo-700">{completeSentence}</span>
                            <button onClick={() => {
                              const u = new SpeechSynthesisUtterance(completeSentence)
                              u.lang = 'en-US'; u.rate = 0.8
                              speechSynthesis.cancel()
                              speechSynthesis.speak(u)
                            }}
                              className="inline-flex ml-2 w-6 h-6 items-center justify-center rounded-full bg-indigo-50 hover:bg-indigo-100"
                              title="発音を聞く">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                              </svg>
                            </button>
                          </p>
                          <div className="bg-white rounded-lg p-3 border border-amber-200">
                            <p className="text-xs text-amber-600 mb-1">声に出しながらノートに3回書こう:</p>
                            <p className="text-base text-gray-300 tracking-wide">
                              {completeSentence}
                            </p>
                            <p className="text-base text-gray-300 tracking-wide">
                              {completeSentence}
                            </p>
                            <p className="text-base text-gray-300 tracking-wide">
                              {completeSentence}
                            </p>
                          </div>
                        </div>
                      )}

                      {q.question_type === 'writing' && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-700">{q.question_text_jp || q.question_text}</p>
                          {q.explanation_jp && (
                            <div className="bg-white rounded-lg p-3 border border-amber-200">
                              <p className="text-xs text-amber-600 mb-1">模範解答を声に出しながらノートに書こう:</p>
                              <p className="text-base text-indigo-700 font-medium">{q.explanation_jp.replace('例: ', '')}</p>
                              <button onClick={() => {
                                const text = (q.explanation_jp || '').replace('例: ', '')
                                const u = new SpeechSynthesisUtterance(text)
                                u.lang = 'en-US'; u.rate = 0.8
                                speechSynthesis.cancel()
                                speechSynthesis.speak(u)
                              }}
                                className="mt-2 text-xs text-indigo-500 flex items-center gap-1 hover:text-indigo-700">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                                </svg>
                                発音を聞く
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 bg-amber-100 rounded-xl p-4">
                <h4 className="font-bold text-amber-800 text-sm mb-2">📝 復習ノートの書き方</h4>
                <ol className="text-sm text-amber-700 space-y-1">
                  <li>1. 間違えた問題の正しい文をノートに書く</li>
                  <li>2. 声に出しながら3回繰り返して書く</li>
                  <li>3. 翌日もう一度テストを受けて確認する</li>
                  <li>4. 3日後にもう一度テストを受ける（忘れかけた頃がベスト！）</li>
                </ol>
              </div>
            </div>
          )}

          {/* アクション */}
          <div className="flex gap-3 pb-4">
            <button onClick={() => { setScreen('ready'); setTestResult(null) }}
              className="flex-1 py-4 bg-indigo-500 hover:bg-indigo-600 active:scale-[0.98] text-white rounded-2xl text-base font-bold transition-all">
              📊 ダッシュボードへ
            </button>
            <button onClick={startTest}
              className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white rounded-2xl text-base font-bold transition-all">
              🔄 もう一度挑戦
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
