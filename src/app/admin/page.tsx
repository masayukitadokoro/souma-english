'use client'
import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Users, Clock, Hash, TrendingUp, BookOpen, ShieldCheck, ChevronRight } from 'lucide-react'

const ADMIN_EMAILS = ['masa@unicornfarm.co', 'moe7120028@gmail.com']

type UserSummary = {
  id: string; email: string; created_at: string; last_active: string | null;
  total_drills: number; total_seconds: number; total_questions: number;
  total_correct: number; test_count: number; test_pct: number;
}
type DrillRecord = {
  id: string; drill_mode: string; question_text: string; correct_count: number;
  total_count: number; duration_seconds: number; completed_at: string;
}
type TestSession = {
  session_id: string; date: string; score: number; total: number; pct: number;
  answers: any[];
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
}
function fmtDateTime(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDuration(s: number) {
  if (s < 60) return `${s}秒`
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec > 0 ? `${m}分${sec}秒` : `${m}分`
}

const DRILL_LABEL: Record<string, string> = {
  spelling: 'スペル練習', grammar: '語順トレーニング', write3: '段階書き取り',
  flashcard: 'フラッシュカード', dictation: 'ディクテーション', reorder: '語順並び替え',
  spelling_practice: 'スペル練習（独立）', vocab_practice: '単語練習',
}

// ─── SVG Line Chart ───
function MiniChart({ data, color = '#6366f1' }: { data: number[]; color?: string }) {
  if (data.length < 2) return <div className="text-xs text-gray-400 text-center py-4">データ不足</div>
  const W = 500, H = 150, PL = 36, PR = 12, PT = 12, PB = 8
  const cW = W - PL - PR, cH = H - PT - PB
  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => ({
    x: PL + (i / (data.length - 1)) * cW,
    y: PT + cH - (v / max) * cH,
    v,
  }))
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = line + ` L${pts[pts.length - 1].x},${PT + cH} L${pts[0].x},${PT + cH} Z`
  const ticks = [0, Math.round(max / 2), max]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      {ticks.map(v => {
        const y = PT + cH - (v / max) * cH
        return <g key={v}>
          <line x1={PL} y1={y} x2={W - PR} y2={y} stroke="#e5e7eb" strokeWidth={1} />
          <text x={PL - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9ca3af">{v}</text>
        </g>
      })}
      <path d={area} fill={color} opacity={0.15} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={3} fill={color} stroke="white" strokeWidth={1.5} />)}
    </svg>
  )
}

export default function AdminPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [users, setUsers] = useState<UserSummary[]>([])
  const [selectedUser, setSelectedUser] = useState<UserSummary | null>(null)
  const [detail, setDetail] = useState<{ drillRecords: DrillRecord[]; testSessions: TestSession[] } | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // 認証チェック
  useEffect(() => {
    async function check() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || !ADMIN_EMAILS.includes(session.user.email || '')) {
        router.push('/login')
        return
      }
      setToken(session.access_token)
      setAuthed(true)
      // ユーザー一覧取得
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setUsers(data.users || [])
      setLoading(false)
    }
    check()
  }, [router])

  // ユーザー詳細取得
  const loadDetail = async (u: UserSummary) => {
    setSelectedUser(u)
    setDetailLoading(true)
    const res = await fetch(`/api/admin/users?userId=${u.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    setDetail(data)
    setDetailLoading(false)
  }

  if (!authed || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShieldCheck size={40} className="text-indigo-400 mx-auto mb-3 animate-pulse" />
          <p className="text-indigo-600 font-medium">管理画面を読み込み中...</p>
        </div>
      </div>
    )
  }

  // ─── ユーザー詳細画面 ───
  if (selectedUser && detail) {
    const drills = detail.drillRecords
    const sessions = detail.testSessions

    // 学習推移データ（過去30日）
    const now = new Date()
    const days30: Record<string, { count: number; seconds: number }> = {}
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      days30[key] = { count: 0, seconds: 0 }
    }
    drills.forEach(r => {
      const d = new Date(r.completed_at)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      if (days30[key]) {
        days30[key].count++
        days30[key].seconds += r.duration_seconds || 0
      }
    })
    const drillChartData = Object.values(days30).map(d => d.count)
    const timeChartData = Object.values(days30).map(d => Math.round(d.seconds / 60))

    // テストスコア推移
    const scoreData = [...sessions].reverse().map(s => s.pct)

    // ドリル種類集計
    const modeStats: Record<string, { count: number; seconds: number }> = {}
    drills.forEach(r => {
      if (!modeStats[r.drill_mode]) modeStats[r.drill_mode] = { count: 0, seconds: 0 }
      modeStats[r.drill_mode].count++
      modeStats[r.drill_mode].seconds += r.duration_seconds || 0
    })

    return (
      <div className="min-h-screen bg-gray-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ヘッダー */}
          <div className="flex items-center gap-3">
            <button onClick={() => { setSelectedUser(null); setDetail(null) }}
              className="p-2 rounded-lg bg-white shadow-sm hover:bg-gray-100 transition-all">
              <ArrowLeft size={18} className="text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{selectedUser.email}</h1>
              <p className="text-xs text-gray-500">登録日: {fmtDate(selectedUser.created_at)}</p>
            </div>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-indigo-600">{drills.length}</div>
              <div className="text-xs text-gray-500">総ドリル数</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-emerald-500">{fmtDuration(drills.reduce((s, d) => s + (d.duration_seconds || 0), 0))}</div>
              <div className="text-xs text-gray-500">総学習時間</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-amber-500">{sessions.length}</div>
              <div className="text-xs text-gray-500">テスト回数</div>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-black text-purple-500">
                {sessions.length > 0 ? `${sessions[0].pct}%` : '-'}
              </div>
              <div className="text-xs text-gray-500">最新テスト正解率</div>
            </div>
          </div>

          {/* 学習推移グラフ */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <Hash size={14} className="text-indigo-500" />ドリル回数（過去30日）
              </h3>
              <MiniChart data={drillChartData} color="#6366f1" />
            </div>
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
                <Clock size={14} className="text-emerald-500" />学習時間（分/過去30日）
              </h3>
              <MiniChart data={timeChartData} color="#10b981" />
            </div>
          </div>

          {/* テストスコア推移 */}
          {sessions.length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <TrendingUp size={14} className="text-purple-500" />テスト正解率の推移
              </h3>
              <MiniChart data={scoreData} color="#8b5cf6" />

              {/* テスト一覧テーブル */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">日時</th>
                      <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">正解</th>
                      <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">問題数</th>
                      <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">正解率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessions.map((s, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-700">{fmtDateTime(s.date)}</td>
                        <td className="py-2 px-3 text-center font-bold text-emerald-600">{s.score}</td>
                        <td className="py-2 px-3 text-center text-gray-500">{s.total}</td>
                        <td className="py-2 px-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            s.pct >= 80 ? 'bg-emerald-100 text-emerald-700' :
                            s.pct >= 50 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-600'
                          }`}>{s.pct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ドリル種類別 */}
          {Object.keys(modeStats).length > 0 && (
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <BookOpen size={14} className="text-indigo-500" />ドリル種類別
              </h3>
              <div className="space-y-2">
                {Object.entries(modeStats).sort((a, b) => b[1].count - a[1].count).map(([mode, st]) => (
                  <div key={mode} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <span className="text-sm text-gray-700 flex-1">{DRILL_LABEL[mode] || mode}</span>
                    <span className="text-xs text-gray-500">{fmtDuration(st.seconds)}</span>
                    <span className="text-sm font-bold text-indigo-600">{st.count}回</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 最近のドリル記録 */}
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-3">最近のドリル記録</h3>
            {drills.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">ドリル記録なし</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">日時</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">種類</th>
                      <th className="text-left py-2 px-3 text-xs font-bold text-gray-500">内容</th>
                      <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">正解</th>
                      <th className="text-center py-2 px-3 text-xs font-bold text-gray-500">時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drills.slice(0, 30).map((r, i) => (
                      <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-700 whitespace-nowrap">{fmtDateTime(r.completed_at)}</td>
                        <td className="py-2 px-3 text-gray-600">{DRILL_LABEL[r.drill_mode] || r.drill_mode}</td>
                        <td className="py-2 px-3 text-gray-500 max-w-[200px] truncate">{r.question_text}</td>
                        <td className="py-2 px-3 text-center">
                          {r.total_count > 0 && (
                            <span className="text-xs font-bold text-emerald-600">{r.correct_count}/{r.total_count}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center text-xs text-gray-500">
                          {r.duration_seconds > 0 ? fmtDuration(r.duration_seconds) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ─── ユーザー詳細ローディング ───
  if (selectedUser && detailLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-indigo-600 animate-pulse">読み込み中...</p>
      </div>
    )
  }

  // ─── ユーザー一覧画面 ───
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <ShieldCheck size={24} className="text-indigo-500" />
            <div>
              <h1 className="text-xl font-bold text-gray-800">管理画面</h1>
              <p className="text-xs text-gray-500">ユーザーの学習状況を確認できます</p>
            </div>
          </div>
        </div>

        {/* 全体サマリー */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-black text-indigo-600">{users.length}</div>
            <div className="text-xs text-gray-500">ユーザー数</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-black text-emerald-500">{users.reduce((s, u) => s + u.total_drills, 0)}</div>
            <div className="text-xs text-gray-500">総ドリル数</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-black text-amber-500">{users.reduce((s, u) => s + u.test_count, 0)}</div>
            <div className="text-xs text-gray-500">総テスト数</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-black text-purple-500">
              {fmtDuration(users.reduce((s, u) => s + u.total_seconds, 0))}
            </div>
            <div className="text-xs text-gray-500">総学習時間</div>
          </div>
        </div>

        {/* ユーザー一覧テーブル */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800 flex items-center gap-2">
              <Users size={16} className="text-indigo-500" />
              ユーザー一覧
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-xs font-bold text-gray-500">メール</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500">ドリル数</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500">学習時間</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500">テスト数</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500">テスト正解率</th>
                  <th className="text-center py-3 px-4 text-xs font-bold text-gray-500">最終活動</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} onClick={() => loadDetail(u)}
                    className="border-b border-gray-50 hover:bg-indigo-50 cursor-pointer transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{u.email}</div>
                      <div className="text-[10px] text-gray-400">登録: {fmtDate(u.created_at)}</div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-indigo-600">{u.total_drills}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-gray-600">
                      {u.total_seconds > 0 ? fmtDuration(u.total_seconds) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-bold text-amber-500">{u.test_count}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {u.test_count > 0 ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          u.test_pct >= 80 ? 'bg-emerald-100 text-emerald-700' :
                          u.test_pct >= 50 ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-600'
                        }`}>{u.test_pct}%</span>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-gray-500">
                      {u.last_active ? fmtDate(u.last_active) : '-'}
                    </td>
                    <td className="py-3 px-4">
                      <ChevronRight size={16} className="text-gray-300" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
