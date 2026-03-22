'use client'
import { usePathname, useRouter } from 'next/navigation'
import { ClipboardCheck, BarChart3, BookOpen, Keyboard, Languages, LogOut } from 'lucide-react'

const NAV_ITEMS = [
  { label: '実力テスト', icon: ClipboardCheck, href: '/test' },
  { label: 'テスト履歴', icon: BarChart3, href: '/test-history' },
  { label: 'スペル練習', icon: Keyboard, href: '/spelling-practice' },
  { label: '単語練習', icon: Languages, href: '/vocab-practice' },
  { label: '学習記録', icon: BookOpen, href: '/study-log' },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()

  const authPages = ['/login', '/signup', '/onboarding', '/motivation', '/logout']
  const hide = authPages.some(p => pathname.startsWith(p))
  if (hide) return null

  return (
    <>
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-52 bg-white border-r border-gray-100 flex-col z-50">
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🔨</span>
            <div>
              <p className="font-bold text-gray-800 text-sm">英語道場</p>
              <p className="text-xs text-gray-400">中学英語テスト</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <button key={href} onClick={() => router.push(href)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                  active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}>
                <Icon size={18} className={active ? 'text-indigo-500' : 'text-gray-400'} />
                <span className="text-sm">{label}</span>
              </button>
            )
          })}
        </nav>
        <div className="p-3 border-t border-gray-100">
          <button onClick={() => router.push('/logout')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all">
            <LogOut size={18} className="text-gray-400" />
            <span className="text-sm">ログアウト</span>
          </button>
        </div>
      </aside>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 safe-area-bottom">
        <div className="flex justify-around py-2">
          {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <button key={href} onClick={() => router.push(href)}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                <Icon size={18} />
                <span className="text-[9px] font-medium">{label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
