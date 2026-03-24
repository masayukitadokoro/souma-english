'use client'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardCheck, BarChart3, BookOpen, Keyboard, Languages, LogOut, Menu, X, Stethoscope } from 'lucide-react'
import PointsBanner from '@/components/PointsBanner'

const NAV_ITEMS = [
  { label: '実力テスト', icon: ClipboardCheck, href: '/test' },
  { label: 'テスト履歴', icon: BarChart3, href: '/test-history' },
  { label: 'スペル練習', icon: Keyboard, href: '/spelling-practice' },
  { label: '単語練習', icon: Languages, href: '/vocab-practice' },
  { label: '学習記録', icon: BookOpen, href: '/study-log' },
  { label: '診断', icon: Stethoscope, href: '/diagnosis' },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const authPages = ['/login', '/signup', '/onboarding', '/motivation', '/logout']
  const hide = authPages.some(p => pathname.startsWith(p))
  if (hide) return null

  const navContent = (
    <>
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">🔨</span>
          <div>
            <p className="font-bold text-gray-800 text-sm">英語道場</p>
            <p className="text-xs text-gray-400">中学英語テスト</p>
          </div>
        </div>
        <PointsBanner />
      </div>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <button
              key={href}
              onClick={() => { router.push(href); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                active
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <Icon size={18} className={active ? 'text-indigo-500' : 'text-gray-400'} />
              <span className="text-sm">{label}</span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => { router.push('/logout'); setOpen(false) }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all"
        >
          <LogOut size={18} className="text-gray-400" />
          <span className="text-sm">ログアウト</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* PC: サイドバー */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-52 bg-white border-r border-gray-100 flex-col z-50">
        {navContent}
      </aside>

      {/* モバイル: トップバー */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔨</span>
          <span className="font-bold text-gray-800 text-sm">英語道場</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* モバイル: オーバーレイ */}
      {open && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 z-50"
          onClick={() => setOpen(false)}
        />
      )}

      {/* モバイル: スライドインメニュー */}
      <div className={`md:hidden fixed top-0 left-0 bottom-0 w-64 bg-white z-50 flex flex-col shadow-xl transition-transform duration-300 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex items-center justify-end p-3">
          <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
            <X size={22} />
          </button>
        </div>
        {navContent}
      </div>
    </>
  )
}
