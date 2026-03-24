'use client'
import { useMonthlyPoints } from '@/hooks/useMonthlyPoints'
import { Coins } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function PointsBanner() {
  const { total, loading } = useMonthlyPoints()
  const router = useRouter()
  const now = new Date()
  const monthLabel = `${now.getMonth() + 1}月`

  return (
    <button
      onClick={() => router.push('/points')}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 hover:from-amber-100 hover:to-yellow-100 transition-all group"
    >
      <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0 shadow-sm group-hover:scale-105 transition-transform">
        <Coins size={18} className="text-white" />
      </div>
      <div className="flex-1 text-left">
        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">{monthLabel}のお小遣い</p>
        {loading ? (
          <div className="h-5 w-16 bg-amber-200 rounded animate-pulse mt-0.5" />
        ) : (
          <p className="text-lg font-bold text-amber-800 leading-tight">
            ¥{total.toLocaleString()}
          </p>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" className="text-amber-400 flex-shrink-0">
        <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}
