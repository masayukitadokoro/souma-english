'use client'
import { useEffect, useState } from 'react'
import TestDrill from '@/components/TestDrill'
import { supabase } from '@/lib/supabase'
import { awardDrillPoints, checkAndAwardDailyBonuses, checkAndAwardStreakBonuses } from '@/lib/points'
import { showPointToast } from '@/components/PointToast'
import { CheckCircle } from 'lucide-react'

const CHANNEL_NAME = 'drill-completion'

export default function DrillPage() {
  const [drillData, setDrillData] = useState<any>(null)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')
  const [drillStartedAt] = useState(Date.now())

  useEffect(() => {
    try {
      const raw = localStorage.getItem('drill_open_data')
      if (!raw) { setError('ドリルデータがありません。元の画面からドリルを開いてください。'); return }
      const data = JSON.parse(raw)
      if (!data.wrongAnswers?.length) { setError('問題データがありません。'); return }
      setDrillData(data)
    } catch {
      setError('データの読み込みに失敗しました。')
    }
  }, [])

  const handleDrillComplete = async () => {
    // Supabaseに保存
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user && drillData) {
        const wa = drillData.wrongAnswers?.[0]
        await supabase.from('drill_records').insert({
          user_id: user.id,
          answer_id: drillData.answerId || null,
          session_id: drillData.sessionId || null,
          drill_mode: drillData.initialMode || 'unknown',
          question_text: wa?.question_text || '',
          question_text_jp: wa?.question_text_jp || '',
          correct_answer: wa?.correct_answer || '',
          question_type: wa?.question_type || '',
          category: wa?.category || '',
          test_score: drillData.testScore || null,
          correct_count: 0,
          total_count: 0,
          duration_seconds: Math.round((Date.now() - drillStartedAt) / 1000),
        })
      }
    } catch (e) { console.error('Failed to save drill record:', e) }

    // BroadcastChannelで元タブに通知
    try {
      const channel = new BroadcastChannel(CHANNEL_NAME)
      channel.postMessage({
        type: 'drill_completed',
        answerId: drillData?.answerId,
        drillMode: drillData?.initialMode,
        timestamp: Date.now(),
      })
      channel.close()
    } catch {}

    // localStorageにも保存（フォールバック）
    try {
      const completedMap = JSON.parse(localStorage.getItem('drill_completed') || '{}')
      if (drillData?.answerId && drillData?.initialMode) {
        if (!completedMap[drillData.answerId]) completedMap[drillData.answerId] = {}
        completedMap[drillData.answerId][drillData.initialMode] = { completed: true, lastAt: Date.now() }
        localStorage.setItem('drill_completed', JSON.stringify(completedMap))
      }
    } catch {}

    // ─── ポイント付与 ───
    const drillPt = await awardDrillPoints(drillData?.answerId || drillData?.initialMode || 'drill')
    if (drillPt.awarded) showPointToast(drillPt.points, 'ドリル完了')
    const dailyB = await checkAndAwardDailyBonuses()
    dailyB.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type) })
    const streakB = await checkAndAwardStreakBonuses()
    streakB.forEach(r => { if (r.awarded) showPointToast(r.pts, r.type) })

    setCompleted(true)
  }

  const handleClose = () => {
    window.close()
    setTimeout(() => { window.history.back() }, 500)
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-sm">
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => window.close()} className="px-6 py-2 bg-indigo-500 text-white rounded-xl font-bold">閉じる</button>
        </div>
      </div>
    )
  }

  if (!drillData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <p className="text-indigo-600 animate-pulse">読み込み中...</p>
      </div>
    )
  }

  if (completed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-sm">
          <CheckCircle size={48} className="text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">ドリル完了！</h2>
          <p className="text-sm text-gray-500 mb-6">学習記録に保存されました</p>
          <button onClick={handleClose} className="w-full py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold transition-colors">
            このタブを閉じる
          </button>
        </div>
      </div>
    )
  }

  return (
    <TestDrill
      wrongAnswers={drillData.wrongAnswers}
      onClose={handleClose}
      initialMode={drillData.initialMode}
      onDrillComplete={handleDrillComplete}
    />
  )
}
