'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Keyboard, FileText, Layers, Headphones, Shuffle, Calendar, Dumbbell, Volume2, BarChart3, Languages, Clock, Hash, TrendingUp } from 'lucide-react'

const DRILL_LABEL: Record<string, string> = {
  spelling: 'スペル練習', grammar: '語順トレーニング', write3: '段階書き取り',
  flashcard: 'フラッシュカード', dictation: 'ディクテーション', reorder: '語順並び替え',
  spelling_practice: 'スペル練習', vocab_practice: '単語練習',
}
const DRILL_ICON: Record<string, React.ReactNode> = {
  spelling: <Keyboard size={14} />, grammar: <Shuffle size={14} />, write3: <FileText size={14} />,
  flashcard: <Layers size={14} />, dictation: <Headphones size={14} />, reorder: <Shuffle size={14} />,
  spelling_practice: <Keyboard size={14} />, vocab_practice: <Languages size={14} />,
}
const DRILL_COLOR: Record<string, string> = {
  spelling_practice: '#6366f1', vocab_practice: '#10b981',
  spelling: '#8b5cf6', grammar: '#f59e0b', write3: '#ef4444',
  flashcard: '#06b6d4', dictation: '#ec4899', reorder: '#f97316',
}
const TYPE_LABEL: Record<string, string> = { multiple_choice: '選択', fill_blank: '穴埋め', vocab_jp_en: '日→英', vocab_en_jp: '英→日', writing: '作文' }
const CAT_LABEL: Record<string, string> = { be_verb: 'be動詞', self_intro: '自己紹介', things_around: '身の回り', spelling_practice: 'スペル練習', vocab_practice: '単語練習' }

type DrillRecord = {
  id: string; user_id: string; answer_id: string; session_id: string;
  drill_mode: string; question_text: string; question_text_jp: string;
  correct_answer: string; question_type: string; category: string;
  results: any; correct_count: number; total_count: number;
  test_score: number | null; completed_at: string;
  started_at: string | null; duration_seconds: number | null;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
function isToday(d: string) {
  return new Date().toDateString() === new Date(d).toDateString()
}
function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text.replace(/___+/g, '').replace(/[()（）]/g, ''))
  u.lang = 'en-US'; u.rate = 0.85
  speechSynthesis.cancel(); speechSynthesis.speak(u)
}
function formatMin(sec: number) {
  if (sec < 60) return `${sec}秒`
  return `${Math.floor(sec / 60)}分${sec % 60 ? `${sec % 60}秒` : ''}`
}

// ── SVGラインチャート ──
function LineChart({ data, yKey, days, label }: {
  data: { date: string; count: number; minutes: number }[]
  yKey: 'count' | 'minutes'
  days: number
  label: string
}) {
  const W = 600, H = 200, PAD = { t: 20, r: 20, b: 40, l: 45 }
  const cw = W - PAD.l - PAD.r, ch = H - PAD.t - PAD.b

  if (data.length === 0) return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">データがありません</div>
  )

  const vals = data.map(d => d[yKey])
  const maxVal = Math.max(...vals, 1)
  const yTicks = 5
  const yStep = Math.ceil(maxVal / yTicks)

  const points = data.map((d, i) => ({
    x: PAD.l + (data.length === 1 ? cw / 2 : (i / (data.length - 1)) * cw),
    y: PAD.t + ch - (d[yKey] / (yStep * yTicks)) * ch,
    val: d[yKey],
    date: d.date,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const areaD = pathD + ` L${points[points.length - 1].x},${PAD.t + ch} L${points[0].x},${PAD.t + ch} Z`

  const xLabelEvery = days <= 7 ? 1 : days <= 30 ? 5 : 15

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const y = PAD.t + ch - (i / yTicks) * ch
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#e5e7eb" strokeWidth={1} />
            <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize={10} fill="#9ca3af">
              {i * yStep}
            </text>
          </g>
        )
      })}
      <path d={areaD} fill="url(#chartGrad)" opacity={0.3} />
      <defs>
        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={days <= 30 ? 4 : 2.5} fill="#6366f1" />
          {days <= 7 && (
            <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={10} fill="#4f46e5" fontWeight="bold">
              {p.val}
            </text>
          )}
        </g>
      ))}
      {points.map((p, i) => {
        if (i % xLabelEvery !== 0 && i !== points.length - 1) return null
        const d = new Date(data[i].date)
        const lbl = `${d.getMonth() + 1}/${d.getDate()}`
        return (
          <text key={i} x={p.x} y={H - 8} textAnchor="middle" fontSize={9} fill="#9ca3af">
            {lbl}
          </text>
        )
      })}
      <text x={4} y={PAD.t - 6} fontSize={9} fill="#9ca3af">{label}</text>
    </svg>
  )
}

export default function StudyLogPage() {
  const router = useRouter()
  const [records, setRecords] = useState<DrillRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, today: 0, todayMin: 0, modes: {} as Record<string, number> })
  const [chartDays, setChartDays] = useState<7 | 30 | 90>(7)
  const [chartMetric, setChartMetric] = useState<'count' | 'minutes'>('count')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('drill_records')
        .select('*').eq('user_id', user.id).order('completed_at', { ascending: false })
      const recs = (data || []) as DrillRecord[]
      setRecords(recs)
      const todayRecs = recs.filter(r => isToday(r.completed_at))
      const todayMin = todayRecs.reduce((s, r) => s + (r.duration_seconds || 0), 0)
      const modes: Record<string, number> = {}
      recs.forEach(r => { modes[r.drill_mode] = (modes[r.drill_mode] || 0) + 1 })
      setStats({ total: recs.length, today: todayRecs.length, todayMin, modes })
      setLoading(false)
    }
    load()
  }, [router])

  const chartData = useMemo(() => {
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - chartDays + 1)
    startDate.setHours(0, 0, 0, 0)
    const dayMap: Record<string, { count: number; minutes: number }> = {}
    for (let i = 0; i < chartDays; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const pad = (n: number) => String(n).padStart(2, '0')
      dayMap[`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`] = { count: 0, minutes: 0 }
    }
    records.forEach(r => {
      const rd = new Date(r.completed_at)
      const key = `${rd.getFullYear()}-${String(rd.getMonth()+1).padStart(2,'0')}-${String(rd.getDate()).padStart(2,'0')}`
      if (dayMap[key] !== undefined) {
        dayMap[key].count += 1
        dayMap[key].minutes += Math.round((r.duration_seconds || 0) / 60 * 10) / 10
      }
    })
    return Object.entries(dayMap).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, count: v.count, minutes: Math.round(v.minutes) }))
  }, [records, chartDays])

  const periodSummary = useMemo(() => {
    const total = chartData.reduce((s, d) => s + d.count, 0)
    const totalMin = chartData.reduce((s, d) => s + d.minutes, 0)
    const activeDays = chartData.filter(d => d.count > 0).length
    return { total, totalMin, activeDays }
  }, [chartData])

  const modeBreakdown = useMemo(() => {
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - chartDays + 1)
    startDate.setHours(0, 0, 0, 0)
    const breakdown: Record<string, { count: number; seconds: number }> = {}
    records.forEach(r => {
      if (new Date(r.completed_at) >= startDate) {
        if (!breakdown[r.drill_mode]) breakdown[r.drill_mode] = { count: 0, seconds: 0 }
        breakdown[r.drill_mode].count += 1
        breakdown[r.drill_mode].seconds += (r.duration_seconds || 0)
      }
    })
    return breakdown
  }, [records, chartDays])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Dumbbell size={40} className="text-indigo-400 mx-auto mb-3 animate-pulse" />
          <p className="text-indigo-600 font-medium">学習記録を読み込み中...</p>
        </div>
      </div>
    )
  }

  const grouped: Record<string, DrillRecord[]> = {}
  records.forEach(r => {
    const dateKey = formatDate(r.completed_at)
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(r)
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Dumbbell size={22} className="text-indigo-500" />
              <h1 className="text-xl font-bold text-gray-800">学習記録</h1>
            </div>
            <button onClick={() => router.push('/test-history')} className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">
              テスト履歴 →
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <div className="text-2xl font-black text-indigo-600">{stats.total}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">総ドリル数</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <div className="text-2xl font-black text-emerald-500">{stats.today}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">今日のドリル</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <div className="text-2xl font-black text-purple-500">{stats.todayMin > 0 ? formatMin(stats.todayMin) : '0分'}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">今日の学習</div>
          </div>
          <div className="bg-white rounded-xl p-3 shadow-sm text-center">
            <div className="text-2xl font-black text-amber-500">{Object.keys(stats.modes).length}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">練習種類</div>
          </div>
        </div>

        {/* チャート */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-indigo-500" />
              <span className="font-bold text-gray-800 text-sm">学習推移</span>
            </div>
            <div className="flex bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setChartMetric('count')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  chartMetric === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                }`}>
                <Hash size={11} />回数
              </button>
              <button onClick={() => setChartMetric('minutes')}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all ${
                  chartMetric === 'minutes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500'
                }`}>
                <Clock size={11} />時間
              </button>
            </div>
          </div>

          <div className="flex px-4 gap-1 mb-2">
            {([7, 30, 90] as const).map(d => (
              <button key={d} onClick={() => setChartDays(d)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  chartDays === d ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}>
                {d}日間
              </button>
            ))}
          </div>

          <div className="px-2 pb-2">
            <LineChart data={chartData} yKey={chartMetric} days={chartDays}
              label={chartMetric === 'count' ? '回数' : '分'} />
          </div>

          <div className="flex justify-around px-4 py-3 bg-gray-50 border-t border-gray-100 text-center">
            <div>
              <div className="text-lg font-black text-indigo-600">{periodSummary.total}</div>
              <div className="text-[10px] text-gray-400">ドリル数</div>
            </div>
            <div>
              <div className="text-lg font-black text-purple-500">{periodSummary.totalMin}分</div>
              <div className="text-[10px] text-gray-400">学習時間</div>
            </div>
            <div>
              <div className="text-lg font-black text-emerald-500">{periodSummary.activeDays}日</div>
              <div className="text-[10px] text-gray-400">学習日数</div>
            </div>
          </div>
        </div>

        {/* ドリル種類別 */}
        {Object.keys(modeBreakdown).length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-500" />
              ドリル種類別（過去{chartDays}日間）
            </h2>
            <div className="space-y-2">
              {Object.entries(modeBreakdown).sort((a, b) => b[1].seconds - a[1].seconds).map(([mode, v]) => {
                const totalSec = Object.values(modeBreakdown).reduce((s, x) => s + x.seconds, 0)
                const pct = totalSec > 0 ? Math.round((v.seconds / totalSec) * 100) : 0
                const color = DRILL_COLOR[mode] || '#6366f1'
                return (
                  <div key={mode} className="flex items-center gap-3">
                    <span className="text-indigo-500 w-5">{DRILL_ICON[mode]}</span>
                    <span className="text-sm text-gray-700 w-24 truncate">{DRILL_LABEL[mode] || mode}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 4)}%`, backgroundColor: color }} />
                    </div>
                    <span className="text-xs text-gray-500 w-14 text-right">{formatMin(v.seconds)}</span>
                    <span className="text-xs font-bold text-gray-600 w-8 text-right">{v.count}回</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 日付ごとの記録 */}
        {records.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <Dumbbell size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">まだドリルの記録がありません</p>
            <button onClick={() => router.push('/test-history')} className="mt-4 px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold">
              テスト履歴へ
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([dateStr, dayRecords]) => (
            <div key={dateStr} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Calendar size={14} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-gray-700">{dateStr}</h3>
                <span className="text-xs text-gray-400">({dayRecords.length}件)</span>
                {isToday(dayRecords[0].completed_at) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">TODAY</span>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
                {dayRecords.map(r => {
                  const hasEnglish = r.question_text && /[a-zA-Z]{2,}/.test(r.question_text)
                  const completeSentence = (r.question_type === 'fill_blank' || r.question_type === 'multiple_choice') && r.question_text && r.correct_answer
                    ? r.question_text.replace(/___+/g, r.correct_answer) : null
                  return (
                    <div key={r.id} className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-indigo-500">{DRILL_ICON[r.drill_mode]}</span>
                          <span className="text-sm font-bold text-gray-800">{DRILL_LABEL[r.drill_mode] || r.drill_mode}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            r.question_type === 'multiple_choice' ? 'bg-indigo-50 text-indigo-600' :
                            r.question_type === 'fill_blank' ? 'bg-teal-50 text-teal-600' :
                            r.question_type === 'writing' ? 'bg-purple-50 text-purple-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>{TYPE_LABEL[r.question_type] || r.question_type}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {r.duration_seconds != null && r.duration_seconds > 0 && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-500 flex items-center gap-0.5">
                              <Clock size={9} />{formatMin(r.duration_seconds)}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">{formatTime(r.completed_at)}</span>
                        </div>
                      </div>
                      {r.correct_count > 0 && r.total_count > 0 && (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-emerald-600">{r.correct_count}/{r.total_count}問正解</span>
                          <span className="text-[10px] text-gray-400">({Math.round((r.correct_count / r.total_count) * 100)}%)</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm text-gray-700">{completeSentence || r.question_text}</p>
                        {hasEnglish && (
                          <button onClick={() => speak(completeSentence || r.question_text)}
                            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-indigo-50 hover:bg-indigo-100">
                            <Volume2 size={10} className="text-indigo-500" />
                          </button>
                        )}
                      </div>
                      {r.correct_answer && (
                        <p className="text-xs text-gray-500">正答: <span className="font-bold text-indigo-600">{r.correct_answer}</span></p>
                      )}
                      {r.test_score !== null && (
                        <div className="mt-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">テストスコア: {r.test_score}点</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
