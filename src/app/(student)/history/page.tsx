'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface DiagnosticResult {
  id: string
  vocab_score: number
  grammar_score: number
  reading_score: number
  weak_points: string[]
  taken_at: string
}

interface StudySession {
  id: string
  duration_minutes: number
  lesson_type: string
  session_date: string
}

export default function HistoryPage() {
  const router = useRouter()
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([])
  const [sessions, setSessions] = useState<StudySession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('id').eq('user_id', user.id).single()
      if (!p) return

      const [{ data: d }, { data: s }] = await Promise.all([
        supabase.from('diagnostic_results').select('*').eq('student_id', p.id).order('taken_at', { ascending: false }),
        supabase.from('study_sessions').select('*').eq('student_id', p.id).order('session_date', { ascending: false }).limit(30),
      ])

      setDiagnostics(d || [])
      setSessions(s || [])
      setLoading(false)
    }
    load()
  }, [router])

  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0)
  const totalSessions = sessions.length

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center">
      <div className="text-4xl animate-bounce">📊</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4 py-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-4">📊 学習履歴</h1>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-purple-600">{totalSessions}</div>
            <div className="text-xs text-gray-400 mt-0.5">学習セッション数</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-pink-600">{totalMinutes}</div>
            <div className="text-xs text-gray-400 mt-0.5">総学習時間（分）</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <h2 className="font-bold text-gray-800 mb-4">📈 診断結果の推移</h2>
          {diagnostics.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">まだ診断を受けていません</p>
              <button onClick={() => router.push('/diagnostic')}
                className="mt-3 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm">
                診断を受ける
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {diagnostics.map((d, i) => {
                const total = d.vocab_score + d.grammar_score + d.reading_score
                const date = new Date(d.taken_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })
                const prev = diagnostics[i + 1]
                const prevTotal = prev ? prev.vocab_score + prev.grammar_score + prev.reading_score : null
                const diff = prevTotal !== null ? total - prevTotal : null
                return (
                  <div key={d.id} className={`border-l-4 pl-4 ${i === 0 ? 'border-indigo-500' : 'border-gray-200'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{date}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-indigo-600">{total}/12</span>
                        {diff !== null && (
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${diff > 0 ? 'bg-green-100 text-green-600' : diff < 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                            {diff > 0 ? `+${diff}` : diff === 0 ? '±0' : diff}
                          </span>
                        )}
                        {i === 0 && <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">最新</span>}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      {[
                        { label: '単語', score: d.vocab_score, color: 'bg-teal-400' },
                        { label: '文法', score: d.grammar_score, color: 'bg-indigo-400' },
                        { label: '読解', score: d.reading_score, color: 'bg-purple-400' },
                      ].map(({ label, score, color }) => (
                        <div key={label} className="flex-1">
                          <div className="flex justify-between text-xs text-gray-400 mb-1">
                            <span>{label}</span><span>{score}/4</span>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div className={`${color} h-1.5 rounded-full`} style={{ width: `${(score/4)*100}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-3">🗓️ 最近の学習</h2>
          {sessions.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">まだ学習記録がありません</p>
          ) : (
            <div className="space-y-2">
              {sessions.slice(0, 10).map(s => {
                const typeLabel: Record<string, string> = { vocabulary: '📚 単語', grammar: '📖 文法', reading: '📄 読解', conversation: '💬 会話' }
                return (
                  <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-sm text-gray-700">{typeLabel[s.lesson_type] || '📝 レッスン'}</span>
                      <span className="text-xs text-gray-400 ml-2">{s.session_date}</span>
                    </div>
                    <span className="text-xs text-gray-400">{s.duration_minutes}分</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
