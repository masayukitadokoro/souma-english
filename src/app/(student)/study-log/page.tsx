'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CheckCircle, XCircle, Keyboard, FileText, Layers, Headphones, Shuffle, Calendar, Dumbbell, Volume2, BarChart3 } from 'lucide-react'

const DRILL_LABEL: Record<string, string> = {
  spelling: 'スペル練習', grammar: '語順トレーニング', write3: '段階書き取り',
  flashcard: 'フラッシュカード', dictation: 'ディクテーション', reorder: '語順並び替え',
}
const DRILL_ICON: Record<string, React.ReactNode> = {
  spelling: <Keyboard size={14} />, grammar: <Shuffle size={14} />, write3: <FileText size={14} />,
  flashcard: <Layers size={14} />, dictation: <Headphones size={14} />, reorder: <Shuffle size={14} />,
}
const TYPE_LABEL: Record<string, string> = { multiple_choice: '選択', fill_blank: '穴埋め', vocab_jp_en: '日→英', vocab_en_jp: '英→日', writing: '作文' }
const CAT_LABEL: Record<string, string> = { be_verb: 'be動詞', self_intro: '自己紹介', things_around: '身の回り' }

type DrillRecord = {
  id: string; user_id: string; answer_id: string; session_id: string;
  drill_mode: string; question_text: string; question_text_jp: string;
  correct_answer: string; question_type: string; category: string;
  results: any; correct_count: number; total_count: number;
  test_score: number | null; completed_at: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
function isToday(d: string) {
  const today = new Date()
  const date = new Date(d)
  return today.toDateString() === date.toDateString()
}

function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text.replace(/___+/g, '').replace(/[()（）]/g, ''))
  u.lang = 'en-US'; u.rate = 0.85
  speechSynthesis.cancel(); speechSynthesis.speak(u)
}

export default function StudyLogPage() {
  const router = useRouter()
  const [records, setRecords] = useState<DrillRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({ total: 0, today: 0, modes: {} as Record<string, number> })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data } = await supabase.from('drill_records')
        .select('*')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
      const recs = (data || []) as DrillRecord[]
      setRecords(recs)

      // 統計
      const todayCount = recs.filter(r => isToday(r.completed_at)).length
      const modes: Record<string, number> = {}
      recs.forEach(r => { modes[r.drill_mode] = (modes[r.drill_mode] || 0) + 1 })
      setStats({ total: recs.length, today: todayCount, modes })
      setLoading(false)
    }
    load()
  }, [router])

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

  // 日付ごとにグループ化
  const grouped: Record<string, DrillRecord[]> = {}
  records.forEach(r => {
    const dateKey = formatDate(r.completed_at)
    if (!grouped[dateKey]) grouped[dateKey] = []
    grouped[dateKey].push(r)
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 py-6">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ヘッダー */}
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

        {/* サマリー */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-black text-indigo-600">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-1">総ドリル数</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-black text-emerald-500">{stats.today}</div>
            <div className="text-xs text-gray-500 mt-1">今日のドリル</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-3xl font-black text-amber-500">{Object.keys(stats.modes).length}</div>
            <div className="text-xs text-gray-500 mt-1">練習種類</div>
          </div>
        </div>

        {/* ドリル種類別の内訳 */}
        {Object.keys(stats.modes).length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-indigo-500" />
              ドリル種類別
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(stats.modes).sort((a, b) => b[1] - a[1]).map(([mode, count]) => (
                <div key={mode} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <span className="text-indigo-500">{DRILL_ICON[mode]}</span>
                  <span className="text-sm text-gray-700 flex-1">{DRILL_LABEL[mode] || mode}</span>
                  <span className="text-sm font-bold text-indigo-600">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 日付ごとの記録 */}
        {records.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <Dumbbell size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 mb-2">まだドリルの記録がありません</p>
            <p className="text-xs text-gray-400">テスト履歴から間違えた問題のドリルをやってみましょう</p>
            <button onClick={() => router.push('/test-history')} className="mt-4 px-6 py-2 bg-indigo-500 text-white rounded-xl text-sm font-bold">
              テスト履歴へ
            </button>
          </div>
        ) : (
          Object.entries(grouped).map(([dateStr, dayRecords]) => (
            <div key={dateStr} className="space-y-2">
              {/* 日付ヘッダー */}
              <div className="flex items-center gap-2 px-1">
                <Calendar size={14} className="text-indigo-400" />
                <h3 className="text-sm font-bold text-gray-700">{dateStr}</h3>
                <span className="text-xs text-gray-400">({dayRecords.length}件)</span>
                {isToday(dayRecords[0].completed_at) && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">TODAY</span>
                )}
              </div>

              {/* その日のドリル一覧 */}
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
                {dayRecords.map(r => {
                  const hasEnglish = r.question_text && /[a-zA-Z]{2,}/.test(r.question_text)
                  const completeSentence = (r.question_type === 'fill_blank' || r.question_type === 'multiple_choice') && r.question_text && r.correct_answer
                    ? r.question_text.replace(/___+/g, r.correct_answer) : null

                  return (
                    <div key={r.id} className="p-4">
                      {/* ドリル情報ヘッダー */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-indigo-500">{DRILL_ICON[r.drill_mode]}</span>
                          <span className="text-sm font-bold text-gray-800">{DRILL_LABEL[r.drill_mode] || r.drill_mode}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                            r.question_type === 'multiple_choice' ? 'bg-indigo-50 text-indigo-600' :
                            r.question_type === 'fill_blank' ? 'bg-teal-50 text-teal-600' :
                            r.question_type === 'writing' ? 'bg-purple-50 text-purple-600' :
                            'bg-amber-50 text-amber-600'
                          }`}>{TYPE_LABEL[r.question_type] || r.question_type}</span>
                          <span className="text-[10px] text-gray-400">{CAT_LABEL[r.category] || r.category}</span>
                        </div>
                        <span className="text-xs text-gray-400">{formatTime(r.completed_at)}</span>
                      </div>

                      {/* 問題文 */}
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm text-gray-700">
                          {completeSentence || r.question_text}
                        </p>
                        {hasEnglish && (
                          <button onClick={() => speak(completeSentence || r.question_text)}
                            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-indigo-50 hover:bg-indigo-100">
                            <Volume2 size={10} className="text-indigo-500" />
                          </button>
                        )}
                      </div>

                      {/* 正答 */}
                      {r.correct_answer && (
                        <p className="text-xs text-gray-500">
                          正答: <span className="font-bold text-indigo-600">{r.correct_answer}</span>
                        </p>
                      )}

                      {/* テストスコア紐付け */}
                      {r.test_score !== null && (
                        <div className="mt-1.5">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                            テストスコア: {r.test_score}点
                          </span>
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
