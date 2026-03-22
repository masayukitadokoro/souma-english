'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import syllabusData from '@/data/syllabus.json'

const TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string; border: string }> = {
  vocab:   { icon: '📚', color: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' },
  grammar: { icon: '📖', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  lesson:  { icon: '💬', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
}

function buildTodayMenu(vocabStats: any, grammarStats: any, masteredGrammarIds: string[], diagnostic: any) {
  const grammarUnits = (syllabusData.syllabus.grammar as any).levels
    .flatMap((l: any) => l.units || [])
  const nextGrammar = grammarUnits.find((u: any) => !masteredGrammarIds.includes(u.id)) || grammarUnits[0]
  const menu = []

  menu.push(vocabStats.review > 0 ? {
    type: 'vocab', title: `単語の復習（${vocabStats.review}語待ち）`,
    description: '忘れる前にもう一度確認しよう', duration_min: 8, url: '/vocab', badge: '復習',
  } : {
    type: 'vocab', title: '今日の新単語（10語）',
    description: `習得済み ${vocabStats.mastered}語 · 続けて伸ばそう`, duration_min: 10, url: '/vocab', badge: null,
  })

  if (nextGrammar) {
    menu.push({
      type: 'grammar', title: `文法：${nextGrammar.title}`,
      description: grammarStats.review > 0 ? `${grammarStats.review}項目の復習あり` : nextGrammar.example || '例文で練習しよう',
      duration_min: 10, url: `/lesson?type=grammar&topic=${encodeURIComponent(nextGrammar.title)}`,
      badge: grammarStats.review > 0 ? '復習' : null,
    })
  }

  const weakest = diagnostic
    ? ([...['vocab', 'grammar', 'reading'] as const].sort((a, b) => {
        const m = { vocab: diagnostic.vocab_score, grammar: diagnostic.grammar_score, reading: diagnostic.reading_score }
        return m[a] - m[b]
      })[0]
    : 'vocab'

  const topicMap = { vocab: '基本単語の文章', grammar: 'be動詞の文章', reading: '短い文章読解' }
  menu.push({
    type: 'lesson', title: '読解練習',
    description: `${weakest === 'reading' ? '弱点強化！' : ''}短い英文を読もう`,
    duration_min: 10, url: `/lesson?type=reading&topic=${encodeURIComponent(topicMap[weakest])}`,
    badge: weakest === 'reading' ? '弱点' : null,
  })

  return menu
}

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [diagnostic, setDiagnostic] = useState<any>(null)
  const [todayMenu, setTodayMenu] = useState<any[]>([])
  const [vocabStats, setVocabStats] = useState({ mastered: 0, review: 0 })
  const [grammarStats, setGrammarStats] = useState({ mastered: 0, review: 0 })
  const [loading, setLoading] = useState(true)
  const [completedToday, setCompletedToday] = useState<string[]>([])
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    setGreeting(h < 12 ? 'おはよう！' : h < 17 ? 'こんにちは！' : 'こんばんは！')
  }, [])

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)

      const { data: d } = await supabase.from('diagnostic_results').select('*')
        .eq('student_id', p.id).order('taken_at', { ascending: false }).limit(1).single()
      if (d) setDiagnostic(d)

      const today = new Date().toISOString().split('T')[0]

      const [{ data: vAll }, { data: gAll }] = await Promise.all([
        supabase.from('word_records').select('mastered,next_review').eq('student_id', p.id),
        supabase.from('grammar_records').select('mastered,next_review,grammar_id').eq('student_id', p.id),
      ])

      const vMastered = vAll?.filter(w => w.mastered).length || 0
      const vReview = vAll?.filter(w => !w.mastered && w.next_review <= today).length || 0
      const gMastered = gAll?.filter(g => g.mastered).length || 0
      const gReview = gAll?.filter(g => !g.mastered && g.next_review <= today).length || 0
      const masteredIds = gAll?.filter(g => g.mastered).map(g => g.grammar_id) || []

      setVocabStats({ mastered: vMastered, review: vReview })
      setGrammarStats({ mastered: gMastered, review: gReview })
      setTodayMenu(buildTodayMenu({ mastered: vMastered, review: vReview }, { mastered: gMastered, review: gReview }, masteredIds, d))
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center"><div className="text-5xl mb-4 animate-bounce">⚡</div><p className="text-indigo-600 font-medium">読み込み中...</p></div>
    </div>
  )

  const plan = diagnostic?.learning_plan as any
  const totalScore = (diagnostic?.vocab_score || 0) + (diagnostic?.grammar_score || 0) + (diagnostic?.reading_score || 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">{greeting}</p>
              <h1 className="text-xl font-bold text-gray-800">{profile?.name}くん 👋</h1>
              <p className="text-indigo-500 text-xs mt-0.5">🎯 {profile?.goal}</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{profile?.streak_count || 0}</div>
              <div className="text-xs text-gray-400">🔥 連続日数</div>
            </div>
          </div>
        </div>

        {/* 今日の学習メニュー */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">🎯 今日の学習メニュー</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">計30分</span>
          </div>
          <div className="space-y-3">
            {todayMenu.map((item, i) => {
              const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.lesson
              const done = completedToday.includes(item.url)
              return (
                <button key={i}
                  onClick={() => { setCompletedToday(prev => [...prev, item.url]); router.push(item.url) }}
                  className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    done ? 'border-green-200 bg-green-50 opacity-60' : `${cfg.border} ${cfg.bg} hover:opacity-90`
                  }`}
                >
                  <div className="text-2xl flex-shrink-0">{done ? '✅' : cfg.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${done ? 'text-green-700 line-through' : cfg.color}`}>{item.title}</p>
                      {item.badge && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          item.badge === '復習' ? 'bg-blue-100 text-blue-600' :
                          item.badge === '弱点' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                        }`}>{item.badge}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{item.description}</p>
                  </div>
                  <span className="text-xs text-gray-300 flex-shrink-0">{item.duration_min}分</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* 進捗サマリー */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">📚 単語</p>
            <div className="text-2xl font-bold text-teal-600">{vocabStats.mastered}<span className="text-sm text-gray-400 font-normal">語</span></div>
            {vocabStats.review > 0 && <div className="text-xs text-blue-500 mt-0.5">🔄 復習 {vocabStats.review}語待ち</div>}
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div className="bg-teal-400 h-1.5 rounded-full" style={{ width: `${Math.min((vocabStats.mastered / 200) * 100, 100)}%` }} />
            </div>
            <div className="text-xs text-gray-300 mt-1">{vocabStats.mastered}/200語</div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-400 mb-1">📖 文法</p>
            <div className="text-2xl font-bold text-indigo-600">{grammarStats.mastered}<span className="text-sm text-gray-400 font-normal">項目</span></div>
            {grammarStats.review > 0 && <div className="text-xs text-blue-500 mt-0.5">🔄 復習 {grammarStats.review}項目待ち</div>}
            <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
              <div className="bg-indigo-400 h-1.5 rounded-full" style={{ width: `${Math.min((grammarStats.mastered / 25) * 100, 100)}%` }} />
            </div>
            <div className="text-xs text-gray-300 mt-1">{grammarStats.mastered}/25項目</div>
          </div>
        </div>

        {/* 最新診断結果 */}
        {diagnostic ? (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">📊 最新の診断結果</h2>
              <button onClick={() => router.push('/diagnostic')}
                className="text-xs text-indigo-600 hover:underline">再診断する →</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 flex-shrink-0">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#6366f1" strokeWidth="3"
                    strokeDasharray={`${(totalScore/12)*100} 100`} strokeLinecap="round"/>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold text-indigo-600">{totalScore}/12</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {[
                  { label: '単語', score: diagnostic.vocab_score,   max: 4, color: 'bg-teal-400' },
                  { label: '文法', score: diagnostic.grammar_score, max: 4, color: 'bg-indigo-400' },
                  { label: '読解', score: diagnostic.reading_score, max: 4, color: 'bg-purple-400' },
                ].map(({ label, score, max, color }) => (
                  <div key={label}>
                    <div className="flex justify-between text-xs text-gray-500 mb-1"><span>{label}</span><span>{score}/{max}</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className={`${color} h-1.5 rounded-full`} style={{ width: `${(score/max)*100}%` }}/>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {plan?.summary && <div className="bg-indigo-50 rounded-xl p-3 text-xs text-indigo-700 mt-3">{plan.summary}</div>}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <div className="text-4xl mb-2">📝</div>
            <p className="text-gray-600 text-sm mb-3">まだ診断テストを受けていません</p>
            <button onClick={() => router.push('/diagnostic')}
              className="px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium">
              診断テストを受ける
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
