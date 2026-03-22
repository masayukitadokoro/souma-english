'use client'
import { useEffect, useState } from 'react'
import TestDrill from '@/components/TestDrill'
import { CheckCircle } from 'lucide-react'

const CHANNEL_NAME = 'drill-completion'

export default function DrillPage() {
  const [drillData, setDrillData] = useState<any>(null)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState('')

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

  const handleDrillComplete = () => {
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

    // localStorageにドリルモード別の完了状態を保存
    try {
      const completedMap = JSON.parse(localStorage.getItem('drill_completed') || '{}')
      if (drillData?.answerId && drillData?.initialMode) {
        if (!completedMap[drillData.answerId]) completedMap[drillData.answerId] = {}
        completedMap[drillData.answerId][drillData.initialMode] = { completed: true, lastAt: Date.now() }
        localStorage.setItem('drill_completed', JSON.stringify(completedMap))
      }
    } catch {}

    setCompleted(true)
  }

  const handleClose = () => {
    if (completed) {
      // ドリル完了後に閉じる場合
      window.close()
      // window.close()が効かない場合のフォールバック
      setTimeout(() => {
        setCompleted(true) // 閉じれなかった場合は完了画面を維持
      }, 500)
    } else {
      window.close()
      setTimeout(() => {
        // 閉じれなかった場合
        window.history.back()
      }, 500)
    }
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center max-w-sm shadow-sm">
          <p className="text-gray-600 mb-4">{error}</p>
          <button onClick={() => window.close()} className="px-6 py-2 bg-indigo-500 text-white rounded-xl font-bold">
            閉じる
          </button>
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
          <p className="text-sm text-gray-500 mb-6">元のタブに結果が反映されました</p>
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
