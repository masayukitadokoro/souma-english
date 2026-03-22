'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const BADGE_DEFS = [
  { key: 'first_login',     label: '🌟 はじめの一歩', desc: '初回ログイン',      color: 'border-yellow-300 bg-yellow-50' },
  { key: 'diagnostic_done', label: '🎯 診断完了',     desc: '診断テスト完了',   color: 'border-blue-300 bg-blue-50' },
  { key: 'first_lesson',    label: '📖 最初のレッスン', desc: 'レッスン完了',    color: 'border-green-300 bg-green-50' },
  { key: 'streak_3',        label: '🔥 3日連続',      desc: '3日連続ログイン',  color: 'border-red-300 bg-red-50' },
  { key: 'vocab_10',        label: '📚 単語マスター10', desc: '10語習得',        color: 'border-teal-300 bg-teal-50' },
  { key: 'vocab_50',        label: '📚 単語マスター50', desc: '50語習得',        color: 'border-teal-400 bg-teal-50' },
  { key: 'grammar_5',       label: '📖 文法マスター',  desc: '5項目習得',       color: 'border-indigo-300 bg-indigo-50' },
  { key: 'perfect_lesson',  label: '💯 パーフェクト',  desc: 'レッスン全問正解', color: 'border-purple-300 bg-purple-50' },
]

export default function ProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [badges, setBadges] = useState<string[]>([])
  const [stats, setStats] = useState({ vocabMastered: 0, grammarMastered: 0, totalSessions: 0, totalMinutes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) return
      setProfile(p)

      const [{ data: b }, { data: v }, { data: g }, { data: s }] = await Promise.all([
        supabase.from('badges').select('badge_key').eq('student_id', p.id),
        supabase.from('word_records').select('mastered').eq('student_id', p.id).eq('mastered', true),
        supabase.from('grammar_records').select('mastered').eq('student_id', p.id).eq('mastered', true),
        supabase.from('study_sessions').select('duration_minutes').eq('student_id', p.id),
      ])

      const earnedKeys = b?.map((x: any) => x.badge_key) || []

      const vCount = v?.length || 0
      const gCount = g?.length || 0
      if (vCount >= 10 && !earnedKeys.includes('vocab_10')) {
        await supabase.from('badges').insert({ student_id: p.id, badge_key: 'vocab_10', title: '単語マスター10' })
        earnedKeys.push('vocab_10')
      }
      if (vCount >= 50 && !earnedKeys.includes('vocab_50')) {
        await supabase.from('badges').insert({ student_id: p.id, badge_key: 'vocab_50', title: '単語マスター50' })
        earnedKeys.push('vocab_50')
      }
      if (gCount >= 5 && !earnedKeys.includes('grammar_5')) {
        await supabase.from('badges').insert({ student_id: p.id, badge_key: 'grammar_5', title: '文法マスター' })
        earnedKeys.push('grammar_5')
      }

      setBadges(earnedKeys)
      setStats({
        vocabMastered: vCount,
        grammarMastered: gCount,
        totalSessions: s?.length || 0,
        totalMinutes: s?.reduce((sum, x) => sum + x.duration_minutes, 0) || 0,
      })
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100 flex items-center justify-center">
      <div className="text-4xl animate-bounce">👤</div>
    </div>
  )

  const earnedCount = BADGE_DEFS.filter(b => badges.includes(b.key)).length

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-yellow-100 p-4 py-6">
      <div className="max-w-lg mx-auto">

        <div className="bg-white rounded-2xl p-6 shadow-sm mb-4 text-center">
          <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-2xl mx-auto mb-3">
            🔨
          </div>
          <h1 className="text-xl font-bold text-gray-800">{profile?.name}くん</h1>
          <p className="text-sm text-gray-500 mt-1">🎯 {profile?.goal}</p>
          <div className="flex justify-center gap-1 mt-3 flex-wrap">
            {(profile?.interests || []).map((i: string) => (
              <span key={i} className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">{i}</span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: '単語習得', value: stats.vocabMastered, unit: '語', color: 'text-teal-600' },
            { label: '文法習得', value: stats.grammarMastered, unit: '項目', color: 'text-indigo-600' },
            { label: '学習回数', value: stats.totalSessions, unit: '回', color: 'text-purple-600' },
            { label: '総学習時間', value: stats.totalMinutes, unit: '分', color: 'text-orange-600' },
          ].map(({ label, value, unit, color }) => (
            <div key={label} className="bg-white rounded-2xl p-4 shadow-sm text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm text-gray-400 font-normal">{unit}</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">🏆 バッジ</h2>
            <span className="text-xs text-gray-400">{earnedCount}/{BADGE_DEFS.length}個獲得</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {BADGE_DEFS.map(({ key, label, desc, color }) => {
              const earned = badges.includes(key)
              return (
                <div key={key} className={`p-3 rounded-xl text-center border-2 transition-all ${
                  earned ? color : 'border-gray-100 bg-gray-50 opacity-40'
                }`}>
                  <p className="text-sm font-medium text-gray-800">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                </div>
              )
            })}
          </div>
        </div>

        <button
          onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="w-full py-3 text-gray-400 text-sm hover:text-gray-600"
        >
          ログアウト
        </button>
      </div>
    </div>
  )
}
