'use client'
import { useEffect, useState } from 'react'
import { Coins } from 'lucide-react'

type PointToastItem = {
  id: number
  points: number
  description: string
}

let toastId = 0
let listeners: ((item: PointToastItem) => void)[] = []

// グローバル関数: どこからでもトースト表示可能
export function showPointToast(points: number, description: string) {
  if (points <= 0) return
  const item: PointToastItem = { id: ++toastId, points, description }
  listeners.forEach(fn => fn(item))
}

export default function PointToastContainer() {
  const [toasts, setToasts] = useState<PointToastItem[]>([])

  useEffect(() => {
    const handler = (item: PointToastItem) => {
      setToasts(prev => [...prev, item])
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== item.id))
      }, 3000)
    }
    listeners.push(handler)
    return () => {
      listeners = listeners.filter(fn => fn !== handler)
    }
  }, [])

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white shadow-lg animate-slide-in"
          style={{
            animation: 'slideIn 0.3s ease-out, fadeOut 0.5s ease-in 2.5s forwards',
          }}
        >
          <Coins size={16} className="flex-shrink-0" />
          <span className="text-sm font-bold">+{t.points} pt</span>
          <span className="text-xs text-white/80">{t.description}</span>
        </div>
      ))}
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; transform: translateY(-10px); }
        }
      `}</style>
    </div>
  )
}
