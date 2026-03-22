'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const MESSAGES: Record<string, { title: string; body: string; emoji: string }> = {
  woodworking: {
    emoji: '🔨',
    title: '世界で活躍する職人へ',
    body: '木工・大工の技術は世界共通語。でも英語があれば、海外の職人と技術を交換したり、外国のお客さんに自分の作品を説明できる。英語は、きみの夢を世界に届ける道具だ。',
  },
  crafts: {
    emoji: '🛠️',
    title: 'ものづくりの力を世界へ',
    body: '日本のものづくりは世界が注目している。英語ができれば、きみの作品を世界中に発信できる。今日から始める英語が、未来の自分を変える。',
  },
  soccer: {
    emoji: '⚽',
    title: '世界のピッチで活躍するために',
    body: '世界トップの選手は英語でコーチと話す。英語がわかれば、外国人コーチの指示が理解でき、海外チームでもプレーできる。英語はきみのサッカーを次のレベルへ連れていく。',
  },
  gaming: {
    emoji: '🎮',
    title: 'ゲームの世界は英語でできている',
    body: '世界中のゲームは英語で作られている。英語がわかれば、最新情報にいち早くアクセスでき、海外のプレイヤーとも繋がれる。英語はきみのゲームライフを無限に広げる。',
  },
  music: {
    emoji: '🎵',
    title: '音楽は世界共通語、英語はその鍵',
    body: '好きなアーティストの歌詞が理解できたら、音楽がもっと好きになる。英語で曲を作れたら、世界中の人に届けられる。英語は音楽の可能性を無限に広げる。',
  },
  default: {
    emoji: '🌍',
    title: '英語で夢への扉を開こう',
    body: '英語は世界15億人が使う言葉。きみの好きなこと・夢と英語を繋げれば、世界が一気に広がる。完璧じゃなくていい。好きなことを英語で語れるようになることから始めよう。',
  },
}

export default function MotivationPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [message, setMessage] = useState(MESSAGES.default)
  const [loading, setLoading] = useState(true)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)

      const interests: string[] = p.interests || []
      const key = interests.find(i => MESSAGES[i as keyof typeof MESSAGES]) || 'default'
      setMessage(MESSAGES[key as keyof typeof MESSAGES] || MESSAGES.default)
      setLoading(false)
      setTimeout(() => setVisible(true), 100)
    }
    load()
  }, [router])

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center">
      <div className="text-5xl animate-bounce">⚡</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 flex items-center justify-center p-4">
      <div className={`max-w-lg w-full transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        <div className="bg-white rounded-2xl p-8 shadow-sm mb-4 text-center">
          <div className="text-6xl mb-4">{message.emoji}</div>
          <h1 className="text-xl font-bold text-gray-800 mb-3">{profile?.name}くん、{message.title}</h1>
          <p className="text-gray-600 leading-relaxed text-sm">{message.body}</p>
        </div>

        <div className="bg-indigo-600 rounded-2xl p-5 mb-4 text-white">
          <p className="text-sm font-medium mb-1">🎯 きみのゴール</p>
          <p className="text-base font-bold">{profile?.goal || '英語をマスターする'}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 mb-6 text-sm text-gray-600">
          <p className="font-medium text-gray-800 mb-2">📋 これからやること</p>
          <div className="space-y-2">
            {[
              { step: '1', text: '今の英語力を診断する（30問・約10分）' },
              { step: '2', text: 'AIがきみ専用のカリキュラムを作る' },
              { step: '3', text: '毎日30分、楽しく続ける' },
            ].map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{step}</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => router.push('/diagnostic')}
          className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-colors"
        >
          診断テストをはじめる →
        </button>
        <p className="text-center text-xs text-gray-400 mt-3">約10分で完了します</p>
      </div>
    </div>
  )
}
