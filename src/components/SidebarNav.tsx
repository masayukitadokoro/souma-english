'use client'
import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from "@/lib/supabase"
import { ClipboardCheck, BarChart3, BookOpen, Keyboard, Languages, LogOut, Menu, X, ShieldCheck } from 'lucide-react'

const NAV_ITEMS = [
  { label: '実力テスト', icon: ClipboardCheck, href: '/test' },
  { label: 'テスト履歴', icon: BarChart3, href: '/test-history' },
  { label: 'スペル練習', icon: Keyboard, href: '/spelling-practice' },
  { label: '単語練習', icon: Languages, href: '/vocab-practice' },
  { label: '学習記録', icon: BookOpen, href: '/study-log' },
]

const ADMIN_EMAILS = ['masa@unicornfarm.co', 'moe7120028@gmail.com']

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && ADMIN_EMAILS.includes(user.email || '')) setIsAdmin(true)
    })
  }, [])
  const [open, setOpen] = useState(false)

  const authPages = ['/login', '/signup', '/onboarding', '/motivation', '/logout']
  const hide = authPages.some(p => pathname.startsWith(p))

  // ページ遷移時にメニューを閉じる
  useEffect(() => { setOpen(false) }, [pathname])

  // メニュー開いてる間はスクロール禁止
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (hide) return null

  const navContent = (
    <>
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, href }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <button key={href}
              onClick={() => { router.push(href); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all ${
                active ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
              }`}>
              <Icon size={20} className={active ? 'text-indigo-500' : 'text-gray-400'} />
              <span className="text-sm">{label}</span>
            </button>
          )
        })}
      </nav>
      <div className="p-3 border-t border-gray-100">
        {isAdmin && (
          <button onClick={() => { router.push("/admin"); setOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all mb-1 ${pathname === "/admin" ? "bg-purple-50 text-purple-700 font-semibold" : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"}`}>
            <ShieldCheck size={20} className={pathname === "/admin" ? "text-purple-500" : "text-gray-400"} />
            <span className="text-sm">管理画面</span>
          </button>
        )}
        <button onClick={() => { router.push('/logout'); setOpen(false) }}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-all">
          <LogOut size={20} className="text-gray-400" />
          <span className="text-sm">ログアウト</span>
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* ===== PC: 固定サイドバー ===== */}
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
        {navContent}
      </aside>

      {/* ===== モバイル: トップバー + ハンバーガー ===== */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 z-50 flex items-center px-4">
        <button onClick={() => setOpen(!open)} className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors">
          {open ? <X size={22} className="text-gray-700" /> : <Menu size={22} className="text-gray-700" />}
        </button>
        <div className="flex items-center gap-2 ml-2">
          <span className="text-lg">🔨</span>
          <p className="font-bold text-gray-800 text-sm">英語道場</p>
        </div>
      </header>

      {/* ===== モバイル: オーバーレイ ===== */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/30" />
        </div>
      )}

      {/* ===== モバイル: スライドメニュー ===== */}
      <div className={`md:hidden fixed top-14 left-0 bottom-0 w-64 bg-white border-r border-gray-100 flex flex-col z-50 transition-transform duration-200 ease-out ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}>
        {navContent}
      </div>
    </>
  )
}
