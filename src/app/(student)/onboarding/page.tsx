'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const STORIES = {
  making: { emoji: '🔨', name: 'タカシさん', job: '宮大工見習い', story: '中2の時、英語が全然できなかった。でもYouTubeで外国の大工が英語で設計図を説明している動画を見て「この人みたいになりたい」と思った。毎日10分だけ英語を続けて、3年後にカナダの工房でインターンができた。', result: '英語で夢をかなえた' },
  sports: { emoji: '⚽', name: 'ケンタさん', job: 'プロサッカー選手', story: '中1の時、外国人コーチの指示が全然わからなかった。悔しくて英語の勉強を始めた。試合中に英語でコーチと話せるようになった時、プレーが変わった。', result: '英語でチームを引っ張った' },
  tech: { emoji: '💻', name: 'ユイさん', job: 'ゲームデザイナー', story: '好きなゲームの設定が英語しかなくて悔しかった。英語を学んでから、海外のゲームコミュニティで友達ができて、一緒にゲームを作るまでになった。', result: '英語で世界と繋がった' },
  music: { emoji: '🎵', name: 'ハルさん', job: 'ミュージシャン', story: '好きなアーティストの歌詞が理解できなかった。英語を学んでから、歌詞の意味が分かって音楽がもっと好きになった。今は英語の曲を自分で作っている。', result: '英語で音楽の世界が広がった' },
}

const INTERESTS_LIST = [
  { id: 'woodworking', label: '木工・大工', emoji: '🔨', category: 'making' },
  { id: 'cooking', label: '料理', emoji: '🍳', category: 'food' },
  { id: 'soccer', label: 'サッカー', emoji: '⚽', category: 'sports' },
  { id: 'baseball', label: '野球', emoji: '⚾', category: 'sports' },
  { id: 'basketball', label: 'バスケ', emoji: '🏀', category: 'sports' },
  { id: 'swimming', label: '水泳', emoji: '🏊', category: 'sports' },
  { id: 'gaming', label: 'ゲーム', emoji: '🎮', category: 'tech' },
  { id: 'programming', label: 'プログラミング', emoji: '💻', category: 'tech' },
  { id: 'drawing', label: '絵を描く', emoji: '🎨', category: 'art' },
  { id: 'music', label: '音楽・楽器', emoji: '🎵', category: 'music' },
  { id: 'anime', label: 'アニメ・マンガ', emoji: '📺', category: 'art' },
  { id: 'reading', label: '読書', emoji: '📚', category: 'learning' },
  { id: 'science', label: '科学・実験', emoji: '🔬', category: 'learning' },
  { id: 'nature', label: '自然・生き物', emoji: '🌿', category: 'nature' },
  { id: 'travel', label: '旅行・地理', emoji: '✈️', category: 'travel' },
  { id: 'fashion', label: 'ファッション', emoji: '👕', category: 'fashion' },
  { id: 'food', label: 'グルメ・食べ物', emoji: '🍜', category: 'food' },
  { id: 'crafts', label: 'ものづくり全般', emoji: '🛠️', category: 'making' },
  { id: 'photography', label: '写真・動画', emoji: '📷', category: 'art' },
  { id: 'dancing', label: 'ダンス', emoji: '💃', category: 'sports' },
  { id: 'martial_arts', label: '武道・格闘技', emoji: '🥋', category: 'sports' },
  { id: 'cycling', label: '自転車', emoji: '🚴', category: 'sports' },
  { id: 'fishing', label: '釣り', emoji: '🎣', category: 'nature' },
  { id: 'gardening', label: '植物・ガーデニング', emoji: '🌱', category: 'nature' },
  { id: 'robots', label: 'ロボット・機械', emoji: '🤖', category: 'tech' },
  { id: 'history', label: '歴史・文化', emoji: '🏯', category: 'learning' },
  { id: 'movies', label: '映画', emoji: '🎬', category: 'art' },
  { id: 'pets', label: 'ペット・動物', emoji: '🐕', category: 'nature' },
  { id: 'fitness', label: '筋トレ・フィットネス', emoji: '💪', category: 'sports' },
  { id: 'volunteering', label: 'ボランティア・社会貢献', emoji: '🤝', category: 'social' },
]

const ENGLISH_GOALS = [
  { id: 'overseas_work', label: '海外で働きたい', emoji: '🌍' },
  { id: 'foreign_friends', label: '外国の友達を作りたい', emoji: '🤝' },
  { id: 'travel', label: '海外旅行を楽しみたい', emoji: '✈️' },
  { id: 'content', label: '英語のコンテンツを楽しみたい', emoji: '📱' },
  { id: 'study_abroad', label: '留学したい', emoji: '🎓' },
  { id: 'job', label: '将来の仕事に活かしたい', emoji: '💼' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [grade, setGrade] = useState<1|2|3|null>(null)
  const [selectedInterests, setSelectedInterests] = useState<string[]>([])
  const [goal, setGoal] = useState('')
  const [selectedEnglishGoals, setSelectedEnglishGoals] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const storyKey = selectedInterests.includes('woodworking') || selectedInterests.includes('crafts') ? 'making'
    : selectedInterests.some(i => ['soccer','baseball','basketball','swimming','dancing','cycling'].includes(i)) ? 'sports'
    : selectedInterests.some(i => ['gaming','programming','robots'].includes(i)) ? 'tech'
    : selectedInterests.includes('music') ? 'music'
    : 'making'
  const story = STORIES[storyKey as keyof typeof STORIES]

  function toggleInterest(id: string) {
    setSelectedInterests(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : prev.length < 10 ? [...prev, id] : prev
    )
  }

  function toggleEnglishGoal(id: string) {
    setSelectedEnglishGoals(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!grade || !name) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('student_profiles').upsert({
      user_id: user.id,
      name,
      grade,
      goal,
      interests: selectedInterests,
      english_goals: selectedEnglishGoals,
    }, { onConflict: 'user_id' })

    router.push('/motivation')
  }

  const steps = [
    { title: 'はじめまして！', subtitle: 'まず基本情報を教えてください' },
    { title: '先輩の話を聞いてみよう', subtitle: '英語で夢をかなえた先輩のストーリー' },
    { title: 'きみの興味は？', subtitle: '好きなことを最大10個選んでね' },
    { title: 'きみの夢・目標は？', subtitle: '英語でやりたいことを教えて' },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 py-8">
      <div className="max-w-lg mx-auto">

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {steps.map((_, i) => (
            <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${i <= step ? 'bg-indigo-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-1">{steps[step].title}</h1>
          <p className="text-sm text-gray-400 mb-6">{steps[step].subtitle}</p>

          {/* Step 0: 基本情報 */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">名前（ニックネームでもOK）</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例：ソウマ"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-800"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">学年</label>
                <div className="grid grid-cols-3 gap-3">
                  {([1,2,3] as const).map(g => (
                    <button key={g} onClick={() => setGrade(g)}
                      className={`py-3 rounded-xl font-medium text-sm border-2 transition-all ${
                        grade === g ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-500 hover:border-indigo-300'
                      }`}>
                      中学{g}年生
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => name && grade && setStep(1)}
                disabled={!name || !grade}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-40 mt-2"
              >
                次へ →
              </button>
            </div>
          )}

          {/* Step 1: 先輩のストーリー */}
          {step === 1 && (
            <div>
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-5 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-4xl">{story.emoji}</div>
                  <div>
                    <p className="font-bold text-gray-800">{story.name}</p>
                    <p className="text-xs text-indigo-600">{story.job}</p>
                  </div>
                  <span className="ml-auto text-xs bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">{story.result}</span>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">「{story.story}」</p>
              </div>

              <div className="bg-yellow-50 rounded-xl p-4 mb-6 text-sm text-yellow-700">
                <p className="font-medium mb-1">💡 {name}くんも同じことができる！</p>
                <p>英語は「完璧」じゃなくていい。好きなことと繋げれば、自然と身についていく。</p>
              </div>

              <button onClick={() => setStep(2)} className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium">
                よし、やってみる！ →
              </button>
            </div>
          )}

          {/* Step 2: 興味選択（30項目） */}
          {step === 2 && (
            <div>
              <p className="text-xs text-gray-400 mb-3">最大10個まで選べます（{selectedInterests.length}/10）</p>
              <div className="grid grid-cols-3 gap-2 mb-6 max-h-80 overflow-y-auto pr-1">
                {INTERESTS_LIST.map(({ id, label, emoji }) => {
                  const selected = selectedInterests.includes(id)
                  return (
                    <button key={id} onClick={() => toggleInterest(id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-all ${
                        selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-100 hover:border-indigo-200'
                      } ${!selected && selectedInterests.length >= 10 ? 'opacity-40' : ''}`}>
                      <span className="text-xl">{emoji}</span>
                      <span className="text-xs text-gray-600 leading-tight">{label}</span>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => selectedInterests.length > 0 && setStep(3)}
                disabled={selectedInterests.length === 0}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-40"
              >
                次へ（{selectedInterests.length}個選択中）→
              </button>
            </div>
          )}

          {/* Step 3: 夢・目標 */}
          {step === 3 && (
            <div>
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-700 mb-1 block">将来の夢・目標（自由に書いてね）</label>
                <textarea
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                  placeholder="例：宮大工になって、世界中の建物を修復したい"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-indigo-400 text-gray-800 resize-none"
                  rows={3}
                />
              </div>

              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-2 block">英語でやりたいことは？（複数OK）</label>
                <div className="grid grid-cols-2 gap-2">
                  {ENGLISH_GOALS.map(({ id, label, emoji }) => {
                    const selected = selectedEnglishGoals.includes(id)
                    return (
                      <button key={id} onClick={() => toggleEnglishGoal(id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm transition-all text-left ${
                          selected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-100 text-gray-600 hover:border-indigo-200'
                        }`}>
                        <span>{emoji}</span>
                        <span className="text-xs">{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saving || !goal}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium disabled:opacity-40"
              >
                {saving ? '保存中...' : '診断テストへ進む 🎯'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
