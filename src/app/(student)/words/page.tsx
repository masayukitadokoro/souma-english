'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface WordRecord {
  word_id: number
  word: string
  translation: string
  repetitions: number
  mastered: boolean
  next_review: string
  last_seen_at: string
  ease_factor: number
}

export default function WordsPage() {
  const router = useRouter()
  const [records, setRecords] = useState<WordRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'mastered' | 'review' | 'learning'>('all')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: p } = await supabase.from('student_profiles').select('id').eq('user_id', user.id).single()
      if (!p) return

      const { data } = await supabase
        .from('word_records')
        .select('*')
        .eq('student_id', p.id)
        .order('last_seen_at', { ascending: false })

      setRecords(data || [])
      setLoading(false)
    }
    load()
  }, [router])

  const today = new Date().toISOString().split('T')[0]
  const mastered = records.filter(r => r.mastered)
  const review = records.filter(r => !r.mastered && r.next_review <= today)
  const learning = records.filter(r => !r.mastered && r.next_review > today)

  const filtered = filter === 'all' ? records
    : filter === 'mastered' ? mastered
    : filter === 'review' ? review
    : learning

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 flex items-center justify-center">
      <div className="text-4xl animate-bounce">📚</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-teal-100 p-4 py-6">
      <div className="max-w-lg mx-auto">
        <h1 className="text-xl font-bold text-gray-800 mb-4">📚 単語帳</h1>

        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: '習得済み', count: mastered.length, color: 'text-green-600', bg: 'bg-green-50' },
            { label: '復習待ち', count: review.length,   color: 'text-blue-600',  bg: 'bg-blue-50' },
            { label: '学習中',   count: learning.length, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(({ label, count, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl p-3 text-center`}>
              <div className={`text-xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>習得進捗</span><span>{mastered.length}/200語</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div className="bg-teal-500 h-3 rounded-full transition-all"
              style={{ width: `${Math.min((mastered.length / 200) * 100, 100)}%` }} />
          </div>
        </div>

        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {(['all','review','learning','mastered'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filter === f ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              { f === 'all' ? `すべて(${records.length})`
              : f === 'review' ? `復習待ち(${review.length})`
              : f === 'learning' ? `学習中(${learning.length})`
              : `習得済み(${mastered.length})` }
            </button>
          ))}
        </div>

        {records.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="text-4xl mb-3">📖</div>
            <p className="text-gray-500 text-sm mb-4">まだ単語を学習していません</p>
            <button onClick={() => router.push('/vocab')}
              className="px-6 py-2 bg-teal-600 text-white rounded-xl text-sm font-medium">
              単語レッスンをはじめる
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => (
              <div key={r.word_id} className="bg-white rounded-xl px-4 py-3 shadow-sm flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  r.mastered ? 'bg-green-400' : r.next_review <= today ? 'bg-blue-400' : 'bg-orange-300'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-800">{r.word}</span>
                    <span className="text-xs text-gray-400">{r.translation}</span>
                  </div>
                  <div className="text-xs text-gray-300 mt-0.5">
                    連続正解 {r.repetitions}回
                    {r.mastered && ' · ✅ 習得済み'}
                    {!r.mastered && r.next_review <= today && ' · 🔄 復習タイミング'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6">
          <button onClick={() => router.push('/vocab')}
            className="w-full py-3 bg-teal-600 text-white rounded-xl font-medium hover:bg-teal-700 transition-colors">
            単語レッスンをはじめる →
          </button>
        </div>
      </div>
    </div>
  )
}
