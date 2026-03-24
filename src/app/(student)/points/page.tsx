'use client'
import { useEffect, useState } from 'react'
import { getMonthlyPoints } from '@/lib/points'
import { Coins, TrendingUp, Flame, Clock, Layers, Trophy, ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

const EVENT_META: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  test_complete:       { label: 'テスト受験',      color: 'text-blue-700',   bg: 'bg-blue-50',    icon: '📝' },
  test_score_80:       { label: '80%以上ボーナス',  color: 'text-blue-700',   bg: 'bg-blue-50',    icon: '✨' },
  test_score_90:       { label: '90%以上ボーナス',  color: 'text-blue-700',   bg: 'bg-blue-50',    icon: '🌟' },
  test_score_100:      { label: '満点ボーナス',     color: 'text-blue-700',   bg: 'bg-blue-50',    icon: '💯' },
  drill_complete:      { label: 'ドリル完了',       color: 'text-purple-700', bg: 'bg-purple-50',  icon: '🔨' },
  spelling_complete:   { label: 'スペル練習',       color: 'text-teal-700',   bg: 'bg-teal-50',    icon: '⌨️' },
  vocab_complete:      { label: '単語練習',         color: 'text-emerald-700',bg: 'bg-emerald-50', icon: '📚' },
  time_bonus_30:       { label: '30分学習ボーナス', color: 'text-orange-700', bg: 'bg-orange-50',  icon: '⏰' },
  time_bonus_60:       { label: '60分学習ボーナス', color: 'text-orange-700', bg: 'bg-orange-50',  icon: '⏱️' },
  streak_3:            { label: '3日連続',          color: 'text-red-700',    bg: 'bg-red-50',     icon: '🔥' },
  streak_7:            { label: '7日連続',          color: 'text-red-700',    bg: 'bg-red-50',     icon: '🔥' },
  streak_14:           { label: '14日連続',         color: 'text-red-700',    bg: 'bg-red-50',     icon: '🔥' },
  streak_21:           { label: '21日連続',         color: 'text-red-700',    bg: 'bg-red-50',     icon: '🔥' },
  streak_full:         { label: '月間皆勤',         color: 'text-red-700',    bg: 'bg-red-50',     icon: '👑' },
  breadth_2:           { label: '2種類学習',        color: 'text-indigo-700', bg: 'bg-indigo-50',  icon: '🎯' },
  breadth_3:           { label: '3種類学習',        color: 'text-indigo-700', bg: 'bg-indigo-50',  icon: '🎯' },
  level_clear_spelling:{ label: 'スペルLvクリア',   color: 'text-teal-700',   bg: 'bg-teal-50',    icon: '🏆' },
  level_clear_vocab:   { label: '単語Lvクリア',     color: 'text-emerald-700',bg: 'bg-emerald-50', icon: '🏆' },
}

type PointEvent = {
  event_type: string
  points: number
  description: string
  created_at: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}

export default function PointsPage() {
  const router = useRouter()
  const [total, setTotal] = useState(0)
  const [events, setEvents] = useState<PointEvent[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`

  useEffect(() => {
    getMonthlyPoints().then(({ total, events }) => {
      setTotal(total)
      setEvents(events)
      setLoading(false)
    })
  }, [])

  // カテゴリ別集計
  const categoryTotals = events.reduce((acc, e) => {
    let cat = 'other'
    if (e.event_type.startsWith('test_')) cat = 'test'
    else if (e.event_type === 'drill_complete') cat = 'drill'
    else if (e.event_type.includes('spelling')) cat = 'spelling'
    else if (e.event_type.includes('vocab')) cat = 'vocab'
    else if (e.event_type.startsWith('time_')) cat = 'time'
    else if (e.event_type.startsWith('streak_')) cat = 'streak'
    else if (e.event_type.startsWith('breadth_')) cat = 'breadth'
    acc[cat] = (acc[cat] || 0) + e.points
    return acc
  }, {} as Record<string, number>)

  // 日付別グループ
  const grouped = events.reduce((acc, e) => {
    const d = formatDate(e.created_at)
    if (!acc[d]) acc[d] = []
    acc[d].push(e)
    return acc
  }, {} as Record<string, PointEvent[]>)

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-200 transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <h1 className="text-xl font-bold text-gray-800">{monthLabel}のポイント</h1>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <div key={i} className="h-24 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : (
          <>
            {/* メイン金額 */}
            <div className="bg-gradient-to-br from-amber-400 to-yellow-500 rounded-2xl p-6 text-center mb-6 shadow-lg">
              <Coins size={32} className="text-white/80 mx-auto mb-2" />
              <p className="text-white/80 text-sm font-medium mb-1">{monthLabel}のお小遣い</p>
              <p className="text-4xl font-bold text-white">¥{total.toLocaleString()}</p>
              <p className="text-white/60 text-xs mt-1">{total.toLocaleString()} ポイント</p>
            </div>

            {/* カテゴリ別サマリー */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { key: 'test', label: 'テスト', icon: <TrendingUp size={16} />, color: 'text-blue-600' },
                { key: 'drill', label: 'ドリル', icon: <Layers size={16} />, color: 'text-purple-600' },
                { key: 'spelling', label: 'スペル', icon: <Trophy size={16} />, color: 'text-teal-600' },
                { key: 'vocab', label: '単語', icon: <Trophy size={16} />, color: 'text-emerald-600' },
                { key: 'time', label: '時間ボーナス', icon: <Clock size={16} />, color: 'text-orange-600' },
                { key: 'streak', label: '連続ボーナス', icon: <Flame size={16} />, color: 'text-red-600' },
              ].filter(c => categoryTotals[c.key]).map(c => (
                <div key={c.key} className="bg-white rounded-xl p-3 border border-gray-100">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={c.color}>{c.icon}</span>
                    <span className="text-xs text-gray-500">{c.label}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-800">+{(categoryTotals[c.key] || 0).toLocaleString()}</p>
                </div>
              ))}
            </div>

            {/* 日付別履歴 */}
            <h2 className="text-sm font-bold text-gray-600 mb-3">獲得履歴</h2>
            {Object.entries(grouped).length === 0 ? (
              <div className="bg-white rounded-2xl p-8 text-center">
                <Coins size={40} className="text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 mb-2">まだポイントがありません</p>
                <p className="text-xs text-gray-400">学習を始めてポイントを貯めましょう！</p>
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([dateStr, dayEvents]) => (
                  <div key={dateStr}>
                    <div className="flex items-center justify-between px-1 mb-2">
                      <span className="text-xs font-bold text-gray-500">{dateStr}</span>
                      <span className="text-xs font-bold text-amber-600">
                        +{dayEvents.reduce((s, e) => s + e.points, 0).toLocaleString()} pt
                      </span>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
                      {dayEvents.map((e, i) => {
                        const meta = EVENT_META[e.event_type] || { label: e.event_type, color: 'text-gray-700', bg: 'bg-gray-50', icon: '•' }
                        return (
                          <div key={i} className="flex items-center gap-3 px-4 py-3">
                            <span className="text-lg">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{e.description}</p>
                              <p className="text-xs text-gray-400">{formatTime(e.created_at)}</p>
                            </div>
                            <span className={`text-sm font-bold ${meta.color}`}>
                              +{e.points}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
