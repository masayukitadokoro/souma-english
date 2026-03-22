'use client'
import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { label: '今日', icon: '🏠', href: '/dashboard' },
  { label: '単語', icon: '📚', href: '/words' },
  { label: '文法', icon: '📖', href: '/grammar-map' },
  { label: '履歴', icon: '📊', href: '/history' },
  { label: 'マイ', icon: '👤', href: '/profile' },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()

  const authPages = ['/login', '/signup', '/onboarding', '/motivation', '/diagnostic', '/logout']
  const lessonPages = ['/lesson', '/vocab', '/grammar']
  const hide = authPages.some(p => pathname.startsWith(p)) || lessonPages.some(p => pathname.startsWith(p))
  if (hide) return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 safe-area-pb">
      <div className="max-w-lg mx-auto flex">
        {NAV_ITEMS.map(({ label, icon, href }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
          return (
            <button
              key={href}
              onClick={() => router.push(href)}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors ${
                active ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <span className="text-xl leading-none">{icon}</span>
              <span className={`text-xs font-medium ${active ? 'text-indigo-600' : 'text-gray-400'}`}>
                {label}
              </span>
              {active && <div className="absolute bottom-0 w-8 h-0.5 bg-indigo-600 rounded-full" />}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
