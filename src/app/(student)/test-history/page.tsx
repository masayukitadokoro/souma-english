'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Dumbbell, ExternalLink, Volume2, ChevronDown, Keyboard, FileText, Layers, Headphones, Shuffle, PenLine } from 'lucide-react'

const CAT_LABEL: Record<string, string> = { be_verb: 'be動詞', self_intro: '自己紹介', things_around: '身の回り' }
const SKILL_LABEL: Record<string, string> = { grammar: '文法', vocabulary: '語彙', writing: '作文' }
const TYPE_LABEL: Record<string, string> = { multiple_choice: '選択', fill_blank: '穴埋め', vocab_jp_en: '日→英', vocab_en_jp: '英→日', writing: '作文' }
const SKILL_COLORS: Record<string, string> = { grammar: '#6366f1', vocabulary: '#f59e0b', writing: '#8b5cf6' }
const CAT_COLORS: Record<string, string> = { be_verb: '#3b82f6', self_intro: '#10b981', things_around: '#f97316' }

const CHANNEL_NAME = 'drill-completion'

type Session = {
  id: string; level: number; total_score: number; passed: boolean;
  weakness_analysis: any; started_at: string; completed_at: string | null;
}
type Answer = {
  id: string; session_id: string; question_id: string; user_answer: string;
  is_correct: boolean; score: number; max_score: number; ai_feedback: string;
  category: string; skill_tag: string; question_type: string;
  question_text?: string; question_text_jp?: string; correct_answer?: string; explanation_jp?: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function formatDateShort(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}
function elapsedMin(start: string, end: string | null) {
  if (!end) return '-'
  const sec = (new Date(end).getTime() - new Date(start).getTime()) / 1000
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`
}

// Simple SVG line chart component
function LineChart({ data, width = 580, height = 160, color = '#6366f1', label = '', showPassLine = false }: {
  data: { x: string; y: number }[]; width?: number; height?: number; color?: string; label?: string; showPassLine?: boolean
}) {
  if (data.length < 1) return null
  const pad = { top: 20, right: 20, bottom: 30, left: 36 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const maxY = Math.max(...data.map(d => d.y), showPassLine ? 100 : 0) || 100
  const minY = 0
  const xStep = data.length > 1 ? w / (data.length - 1) : w / 2
  const points = data.map((d, i) => ({
    cx: pad.left + (data.length > 1 ? i * xStep : w / 2),
    cy: pad.top + h - ((d.y - minY) / (maxY - minY)) * h,
  }))
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx},${p.cy}`).join(' ')
  const areaD = pathD + ` L${points[points.length - 1].cx},${pad.top + h} L${points[0].cx},${pad.top + h} Z`
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block' }}>
      {[0, 25, 50, 75, 100].filter(v => v <= maxY).map(v => {
        const y = pad.top + h - (v / maxY) * h
        return (<g key={v}><line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#e2e8f0" strokeWidth="0.5" /><text x={pad.left - 6} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{v}</text></g>)
      })}
      {showPassLine && (<g><line x1={pad.left} y1={pad.top + h - (80 / maxY) * h} x2={width - pad.right} y2={pad.top + h - (80 / maxY) * h} stroke="#6366f1" strokeWidth="1" strokeDasharray="4 3" opacity="0.5" /><text x={width - pad.right + 4} y={pad.top + h - (80 / maxY) * h + 4} fill="#6366f1" fontSize="9" opacity="0.7">80点</text></g>)}
      <path d={areaD} fill={color} opacity="0.08" />
      <path d={pathD} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (<g key={i}><circle cx={p.cx} cy={p.cy} r="4" fill="white" stroke={color} strokeWidth="2" /><text x={p.cx} y={p.cy - 10} textAnchor="middle" fill={color} fontSize="10" fontWeight="600">{data[i].y}</text></g>))}
      {data.map((d, i) => (<text key={i} x={points[i].cx} y={height - 4} textAnchor="middle" fill="#94a3b8" fontSize="9">{d.x}</text>))}
    </svg>
  )
}

function MultiLineChart({ datasets, width = 580, height = 180, label = '' }: {
  datasets: { name: string; color: string; data: number[] }[]; width?: number; height?: number; label?: string;
}) {
  if (!datasets.length || !datasets[0].data.length) return null
  const pad = { top: 20, right: 100, bottom: 24, left: 36 }
  const w = width - pad.left - pad.right
  const h = height - pad.top - pad.bottom
  const len = datasets[0].data.length
  const xStep = len > 1 ? w / (len - 1) : w / 2
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" style={{ display: 'block' }}>
      {[0, 50, 100].map(v => { const y = pad.top + h - (v / 100) * h; return (<g key={v}><line x1={pad.left} y1={y} x2={pad.left + w} y2={y} stroke="#e2e8f0" strokeWidth="0.5" /><text x={pad.left - 6} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10">{v}%</text></g>) })}
      {datasets.map((ds, di) => { const pts = ds.data.map((v, i) => ({ cx: pad.left + (len > 1 ? i * xStep : w / 2), cy: pad.top + h - (v / 100) * h })); const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.cx},${p.cy}`).join(' '); return (<g key={di}><path d={pathD} fill="none" stroke={ds.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />{pts.map((p, i) => <circle key={i} cx={p.cx} cy={p.cy} r="3" fill="white" stroke={ds.color} strokeWidth="1.5" />)}</g>) })}
      {datasets.map((ds, i) => (<g key={i} transform={`translate(${pad.left + w + 12}, ${pad.top + i * 18})`}><rect width="10" height="10" rx="2" fill={ds.color} /><text x="14" y="9" fill="#64748b" fontSize="10">{ds.name}</text></g>))}
      {datasets[0].data.map((_, i) => (<text key={i} x={pad.left + (len > 1 ? i * xStep : w / 2)} y={height - 4} textAnchor="middle" fill="#94a3b8" fontSize="9">#{i + 1}</text>))}
    </svg>
  )
}

// ─── ドリル完了状態管理（モード別） ───
type DrillCompletedMap = Record<string, Record<string, { completed: boolean; lastAt: number }>>

function loadDrillCompleted(): DrillCompletedMap {
  try { return JSON.parse(localStorage.getItem('drill_completed') || '{}') } catch { return {} }
}

function openDrillInNewTab(answer: Answer, mode: string) {
  const drillData = {
    answerId: answer.id,
    initialMode: mode,
    wrongAnswers: [{
      question_text: answer.question_text || '',
      question_text_jp: answer.question_text_jp || '',
      correct_answer: answer.correct_answer || '',
      explanation_jp: answer.explanation_jp || '',
      user_answer: answer.user_answer,
      question_type: answer.question_type,
      category: answer.category,
      level: 1,
    }],
  }
  localStorage.setItem('drill_open_data', JSON.stringify(drillData))
  window.open('/drill', '_blank')
}

export default function TestHistoryPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [progress, setProgress] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedAnswers, setExpandedAnswers] = useState<Answer[]>([])
  const [loadingAnswers, setLoadingAnswers] = useState(false)
  const [tab, setTab] = useState<'dashboard' | 'history'>('dashboard')
  const [drillCompleted, setDrillCompleted] = useState<DrillCompletedMap>({})

  // ドリル完了状態の読み込み + BroadcastChannel
  useEffect(() => {
    setDrillCompleted(loadDrillCompleted())

    let channel: BroadcastChannel | null = null
    try {
      channel = new BroadcastChannel(CHANNEL_NAME)
      channel.onmessage = (e) => {
        if (e.data?.type === 'drill_completed') {
          // 別タブからの完了通知
          setDrillCompleted(loadDrillCompleted())
        }
      }
    } catch {}

    // storageイベントも監視（BroadcastChannelのフォールバック）
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'drill_completed') setDrillCompleted(loadDrillCompleted())
    }
    window.addEventListener('storage', onStorage)

    return () => {
      channel?.close()
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: sess } = await supabase.from('test_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: true })
      setSessions(sess || [])
      const { data: prog } = await supabase.from('user_progress').select('*').eq('user_id', user.id)
      if (prog?.[0]) setProgress(prog[0])
      setLoading(false)
    }
    load()
  }, [router])

  // フォーカス時にも完了状態を再読み込み（タブ切り替え時）
  useEffect(() => {
    const onFocus = () => setDrillCompleted(loadDrillCompleted())
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const toggleExpand = async (sessionId: string) => {
    if (expandedId === sessionId) { setExpandedId(null); return }
    setExpandedId(sessionId)
    setLoadingAnswers(true)
    const { data: answers } = await supabase.from('test_answers').select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
    if (answers && answers.length > 0) {
      const qIds = answers.map(a => a.question_id).filter(Boolean)
      const { data: questions } = await supabase.from('questions').select('id,question_text,question_text_jp,correct_answer,explanation_jp').in('id', qIds)
      const qMap = new Map((questions || []).map(q => [q.id, q]))
      const enriched = answers.map(a => {
        const q = qMap.get(a.question_id)
        return { ...a, question_text: q?.question_text, question_text_jp: q?.question_text_jp, correct_answer: q?.correct_answer, explanation_jp: q?.explanation_jp }
      })
      setExpandedAnswers(enriched)
    } else {
      setExpandedAnswers([])
    }
    setLoadingAnswers(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center"><div className="text-5xl mb-4 animate-bounce">📊</div><p className="text-indigo-600 font-medium">読み込み中...</p></div>
      </div>
    )
  }

  // ★ 完了済みセッションのみ（0/100未完了は除外）
  const completedSessions = sessions.filter(s => s.completed_at && s.total_score > 0)
  const reversedCompleted = [...completedSessions].reverse()

  // Stats（完了済みのみ）
  const totalTests = completedSessions.length
  const avgScore = totalTests > 0 ? Math.round(completedSessions.reduce((s, c) => s + c.total_score, 0) / totalTests) : 0
  const bestScore = totalTests > 0 ? Math.max(...completedSessions.map(s => s.total_score)) : 0
  const passCount = completedSessions.filter(s => s.passed).length
  const passRate = totalTests > 0 ? Math.round((passCount / totalTests) * 100) : 0

  const dailyCounts: Record<string, number> = {}
  completedSessions.forEach(s => {
    const d = new Date(s.started_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
    dailyCounts[d] = (dailyCounts[d] || 0) + 1
  })

  const scoreTrend = completedSessions.slice(-15).map((s) => ({
    x: formatDateShort(s.started_at), y: Math.round(s.total_score),
  }))

  const timeTrend = completedSessions.filter(s => s.completed_at).slice(-15).map(s => {
    const sec = (new Date(s.completed_at!).getTime() - new Date(s.started_at).getTime()) / 1000
    return { x: formatDateShort(s.started_at), y: Math.round(sec / 60) }
  })

  const sessionsWithAnalysis = completedSessions.filter(s => s.weakness_analysis?.byCategory)
  const categoryKeys = ['be_verb', 'self_intro', 'things_around']
  const skillKeys = ['grammar', 'vocabulary', 'writing']
  const catDatasets = categoryKeys.map(key => ({
    name: CAT_LABEL[key] || key, color: CAT_COLORS[key] || '#888',
    data: sessionsWithAnalysis.slice(-10).map(s => { const cat = s.weakness_analysis?.byCategory?.find((c: any) => c.key === key); return cat?.pct || 0 }),
  })).filter(ds => ds.data.some(v => v > 0))
  const skillDatasets = skillKeys.map(key => ({
    name: SKILL_LABEL[key] || key, color: SKILL_COLORS[key] || '#888',
    data: sessionsWithAnalysis.slice(-10).map(s => { const sk = s.weakness_analysis?.bySkill?.find((c: any) => c.key === key); return sk?.pct || 0 }),
  })).filter(ds => ds.data.some(v => v > 0))

  const levelChanges: { date: string; from: number; to: number }[] = []
  completedSessions.forEach((s, i) => {
    if (i > 0 && s.level !== completedSessions[i - 1].level) {
      levelChanges.push({ date: formatDate(s.started_at), from: completedSessions[i - 1].level, to: s.level })
    }
  })

  // ドリル推薦ロジック
  function getDrillRecs(a: Answer) {
    const recs: { key: string; icon: React.ReactNode; label: string }[] = []
    if (a.is_correct) return recs
    if (a.question_type === 'vocab_jp_en' || a.question_type === 'vocab_en_jp') {
      recs.push({ key: 'spelling', icon: <Keyboard size={12} />, label: 'スペル練習' })
      recs.push({ key: 'flashcard', icon: <Layers size={12} />, label: 'フラッシュカード' })
      recs.push({ key: 'dictation', icon: <Headphones size={12} />, label: 'ディクテーション' })
    } else if (a.question_type === 'fill_blank' || a.question_type === 'multiple_choice') {
      recs.push({ key: 'grammar', icon: <Shuffle size={12} />, label: '語順トレーニング' })
      recs.push({ key: 'write3', icon: <FileText size={12} />, label: '3回書き取り' })
      recs.push({ key: 'reorder', icon: <Shuffle size={12} />, label: '語順並び替え' })
    } else if (a.question_type === 'writing') {
      recs.push({ key: 'write3', icon: <FileText size={12} />, label: '3回書き取り' })
      recs.push({ key: 'dictation', icon: <Headphones size={12} />, label: 'ディクテーション' })
      recs.push({ key: 'reorder', icon: <Shuffle size={12} />, label: '語順並び替え' })
    }
    return recs
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">📊 テスト履歴・進捗</h1>
            <button onClick={() => router.push('/test')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              テストに戻る →
            </button>
          </div>
          <div className="flex bg-gray-100 rounded-xl p-1">
            <button onClick={() => setTab('dashboard')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'dashboard' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
              📈 ダッシュボード
            </button>
            <button onClick={() => setTab('history')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tab === 'history' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'}`}>
              📋 テスト一覧
            </button>
          </div>
        </div>

        {tab === 'dashboard' && (
          <>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-2xl font-black text-indigo-600">{totalTests}</div><div className="text-[10px] text-gray-500 mt-0.5">受験回数</div></div>
              <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-2xl font-black text-amber-500">{avgScore}</div><div className="text-[10px] text-gray-500 mt-0.5">平均スコア</div></div>
              <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-2xl font-black text-emerald-500">{bestScore}</div><div className="text-[10px] text-gray-500 mt-0.5">最高スコア</div></div>
              <div className="bg-white rounded-xl p-3 shadow-sm text-center"><div className="text-2xl font-black text-purple-500">{passRate}%</div><div className="text-[10px] text-gray-500 mt-0.5">合格率</div></div>
            </div>
            {scoreTrend.length > 1 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm"><h2 className="font-bold text-gray-800 mb-3">📈 スコア推移</h2><LineChart data={scoreTrend} color="#6366f1" showPassLine /></div>
            )}
            {catDatasets.length > 0 && catDatasets[0].data.length > 1 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm"><h2 className="font-bold text-gray-800 mb-3">🏷️ カテゴリ別 正答率推移</h2><MultiLineChart datasets={catDatasets} /></div>
            )}
            {skillDatasets.length > 0 && skillDatasets[0].data.length > 1 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm"><h2 className="font-bold text-gray-800 mb-3">🎯 スキル別 正答率推移</h2><MultiLineChart datasets={skillDatasets} /></div>
            )}
            {timeTrend.length > 1 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm"><h2 className="font-bold text-gray-800 mb-3">⏱ 所要時間推移（分）</h2><LineChart data={timeTrend} color="#f59e0b" /></div>
            )}
            {Object.keys(dailyCounts).length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <h2 className="font-bold text-gray-800 mb-3">📅 日別受験回数</h2>
                <div className="flex items-end gap-2 h-24">
                  {Object.entries(dailyCounts).slice(-14).map(([date, count]) => (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[10px] text-gray-600 font-medium">{count}</span>
                      <div className="w-full rounded-t-md bg-indigo-400" style={{ height: `${Math.max(count * 24, 8)}px` }} />
                      <span className="text-[9px] text-gray-400">{date}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="font-bold text-gray-800 mb-3">🏆 レベル昇格の記録</h2>
              {levelChanges.length > 0 ? (
                <div className="space-y-2">
                  {levelChanges.map((lc, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-emerald-50 rounded-xl">
                      <span className="text-2xl">🎊</span>
                      <div><p className="text-sm font-bold text-emerald-700">レベル {lc.from} → {lc.to}</p><p className="text-xs text-emerald-600">{lc.date}</p></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4"><p className="text-sm text-gray-400">まだレベルアップの記録がありません</p><p className="text-xs text-gray-300 mt-1">80点以上でレベルアップ！</p></div>
              )}
              <div className="mt-3 flex gap-1">
                {Array.from({ length: 15 }, (_, i) => i + 1).map(lv => (
                  <div key={lv} className={`flex-1 h-6 rounded text-[9px] font-bold flex items-center justify-center ${
                    lv < (progress?.current_level || 1) ? 'bg-emerald-100 text-emerald-600' :
                    lv === (progress?.current_level || 1) ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-300'
                  }`}>{lv}</div>
                ))}
              </div>
            </div>
          </>
        )}

        {tab === 'history' && (
          <>
            {reversedCompleted.length === 0 ? (
              <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
                <div className="text-5xl mb-3">📝</div>
                <p className="text-gray-600">まだテストを受けていません</p>
                <button onClick={() => router.push('/test')} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">テストを受ける</button>
              </div>
            ) : (
              <div className="space-y-3">
                {reversedCompleted.map(s => {
                  const isExpanded = expandedId === s.id
                  const elapsed = elapsedMin(s.started_at, s.completed_at)
                  const score = Math.round(s.total_score)

                  return (
                    <div key={s.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                      <button onClick={() => toggleExpand(s.id)}
                        className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-50 transition-colors">
                        <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
                          s.passed ? 'bg-emerald-50 border-2 border-emerald-200' :
                          score >= 60 ? 'bg-amber-50 border-2 border-amber-200' : 'bg-red-50 border-2 border-red-200'
                        }`}>
                          <span className={`text-lg font-black ${s.passed ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : 'text-red-500'}`}>{score}</span>
                          <span className="text-[9px] text-gray-400">/ 100</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-bold text-gray-800">レベル {s.level}</span>
                            {s.passed && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium">合格</span>}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span>{formatDate(s.started_at)}</span><span>⏱ {elapsed}</span>
                          </div>
                          {s.weakness_analysis?.bySkill && (
                            <div className="flex gap-2 mt-1.5">
                              {s.weakness_analysis.bySkill.map((sk: any) => (
                                <span key={sk.key} className={`text-[10px] font-medium ${sk.pct >= 80 ? 'text-emerald-500' : sk.pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>
                                  {sk.label} {sk.pct}%
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <ChevronDown size={20} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-100 p-4">
                          {loadingAnswers ? (
                            <p className="text-sm text-gray-400 text-center py-4 animate-pulse">読み込み中...</p>
                          ) : (
                            <>
                              {s.weakness_analysis?.byCategory && (
                                <div className="mb-4">
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div>
                                      <p className="text-xs font-bold text-gray-600 mb-2">カテゴリ別</p>
                                      {s.weakness_analysis.byCategory.map((c: any) => (
                                        <div key={c.key} className="mb-1.5">
                                          <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600">{c.label}</span><span className={`font-bold ${c.pct >= 80 ? 'text-emerald-500' : c.pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{c.pct}%</span></div>
                                          <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-1.5 rounded-full ${c.pct >= 80 ? 'bg-emerald-400' : c.pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${c.pct}%` }} /></div>
                                        </div>
                                      ))}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-gray-600 mb-2">スキル別</p>
                                      {s.weakness_analysis.bySkill.map((sk: any) => (
                                        <div key={sk.key} className="mb-1.5">
                                          <div className="flex justify-between text-xs mb-0.5"><span className="text-gray-600">{sk.label}</span><span className={`font-bold ${sk.pct >= 80 ? 'text-emerald-500' : sk.pct >= 50 ? 'text-amber-500' : 'text-red-500'}`}>{sk.pct}%</span></div>
                                          <div className="h-1.5 bg-gray-100 rounded-full"><div className={`h-1.5 rounded-full ${sk.pct >= 80 ? 'bg-emerald-400' : sk.pct >= 50 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${sk.pct}%` }} /></div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <p className="text-xs font-bold text-gray-600 mb-2">問題別（{expandedAnswers.filter(a => a.is_correct).length}/{expandedAnswers.length} 正解）</p>
                              <div className="space-y-2">
                                {expandedAnswers.map((a, i) => {
                                  const hasEnglish = a.question_text && /[a-zA-Z]{2,}/.test(a.question_text)
                                  const completeSentence = (a.question_type === 'fill_blank' || a.question_type === 'multiple_choice') && a.question_text && a.correct_answer
                                    ? a.question_text.replace(/___+/g, a.correct_answer) : null
                                  const drillRecs = getDrillRecs(a)
                                  const answerDrills = drillCompleted[a.id] || {}
                                  const anyDrillDone = Object.keys(answerDrills).length > 0
                                  const allDrillsDone = drillRecs.length > 0 && drillRecs.every(dr => answerDrills[dr.key]?.completed)

                                  return (
                                    <div key={a.id} className={`p-3 rounded-xl text-sm ${!a.is_correct ? 'bg-red-50 border border-red-100' : 'bg-gray-50 border border-gray-100'}`}>
                                      <div className="flex justify-between items-start mb-1.5">
                                        <div className="flex items-center gap-1.5">
                                          {a.is_correct ? <CheckCircle size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />}
                                          <span className="font-bold text-gray-700 text-xs">問{i + 1}</span>
                                          <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${
                                            a.question_type === 'multiple_choice' ? 'bg-indigo-50 text-indigo-600' :
                                            a.question_type === 'fill_blank' ? 'bg-teal-50 text-teal-600' :
                                            a.question_type === 'writing' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'
                                          }`}>{TYPE_LABEL[a.question_type]}</span>
                                          <span className="text-[9px] text-gray-400">{CAT_LABEL[a.category] || a.category}</span>
                                          {/* 全ドリル完了ラベル */}
                                          {allDrillsDone && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-700 flex items-center gap-0.5">
                                              <CheckCircle size={8} />全復習済
                                            </span>
                                          )}
                                          {anyDrillDone && !allDrillsDone && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-700 flex items-center gap-0.5">
                                              {Object.keys(answerDrills).length}/{drillRecs.length}復習済
                                            </span>
                                          )}
                                        </div>
                                        <span className={`text-xs font-bold ${a.score > 0 ? 'text-emerald-600' : 'text-red-500'}`}>{a.score}/{a.max_score}</span>
                                      </div>

                                      {a.question_text_jp && <p className="text-xs text-gray-500 mb-0.5">{a.question_text_jp}</p>}
                                      {a.question_text && (
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                          <p className="text-sm font-semibold text-gray-800">{a.question_text}</p>
                                          {hasEnglish && (
                                            <button onClick={() => {
                                              const text = (a.question_text || '').replace(/___+/g, a.correct_answer || 'blank')
                                              const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = 0.85
                                              speechSynthesis.cancel(); speechSynthesis.speak(u)
                                            }} className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-indigo-50 hover:bg-indigo-100" title="発音を聞く">
                                              <Volume2 size={10} className="text-indigo-500" />
                                            </button>
                                          )}
                                        </div>
                                      )}

                                      <p className="text-xs text-gray-600">
                                        回答: {a.user_answer
                                          ? <span className={`font-bold ${a.is_correct ? 'text-emerald-600' : 'text-red-500'}`}>{a.user_answer}</span>
                                          : <span className="text-gray-400 italic">未回答</span>}
                                      </p>
                                      {a.correct_answer && (
                                        <p className="text-xs text-gray-600 mt-0.5">
                                          正答: <span className="font-bold text-indigo-600">{a.correct_answer}</span>
                                          {completeSentence && <span className="text-gray-400 ml-1">（{completeSentence}）</span>}
                                        </p>
                                      )}
                                      {!a.is_correct && a.ai_feedback && <p className="text-xs text-gray-500 mt-1">{a.ai_feedback}</p>}
                                      {!a.is_correct && a.explanation_jp && (
                                        <div className="mt-1.5 bg-indigo-50 rounded-lg p-2"><p className="text-xs text-indigo-700">{a.explanation_jp}</p></div>
                                      )}

                                      {/* ドリルボタン（別タブで開く・モード別ステータス） */}
                                      {drillRecs.length > 0 && (
                                        <div className="mt-2 pt-2 border-t border-red-100">
                                          <p className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1">
                                            <Dumbbell size={12} className="text-amber-600" />
                                            この問題を復習:
                                          </p>
                                          <div className="flex flex-col gap-1.5">
                                            {drillRecs.map(dr => {
                                              const modeCompleted = answerDrills[dr.key]?.completed
                                              return (
                                                <button key={dr.key} onClick={() => openDrillInNewTab(a, dr.key)}
                                                  className={`w-full px-3 py-2 rounded-lg text-[12px] font-medium transition-all active:scale-[0.98] flex items-center gap-2 ${
                                                    modeCompleted
                                                      ? 'bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                                      : 'bg-white border border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400'
                                                  }`}>
                                                  {dr.icon}
                                                  <span className="flex-1 text-left">{dr.label}</span>
                                                  {modeCompleted ? (
                                                    <span className="flex items-center gap-1 text-[10px] text-emerald-600">
                                                      <CheckCircle size={10} />終了 — もう一回
                                                    </span>
                                                  ) : (
                                                    <ExternalLink size={12} className="text-amber-400" />
                                                  )}
                                                </button>
                                              )
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
