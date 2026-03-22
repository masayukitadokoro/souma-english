'use client'
import { usePathname, useRouter } from 'next/navigation'

const NAV_ITEMS = [
  { label: '目的確認', icon: '🎯', href: '/journal' },
  { label: '今日の学習', icon: '🏠', href: '/dashboard' },
  { label: '単語帳',     icon: '📚', href: '/words' },
  { label: '単語練習',   icon: '⌨️', href: '/vocab-typing' },
  { label: '文法マップ', icon: '📖', href: '/grammar-map' },
  { label: '診断を受ける', icon: '🎯', href: '/diagnostic' },
  { label: '実力テスト', icon: '📝', href: '/test' },
  { label: 'テスト履歴', icon: '📊', href: '/test-history' },
  { label: '学習履歴',   icon: '📊', href: '/history' },
  { label: 'マイページ', icon: '👤', href: '/profile' },
]

export default function SidebarNav() {
  const pathname = usePathname()
  const router = useRouter()

  const hide = ['/login', '/signup', '/onboarding', '/motivation', '/logout', '/lesson', '/vocab-lesson', '/grammar-lesson'].some(p => pathname.startsWith(p))
  if (hide) return null

  return (
    <div style={{
      width: 200, minHeight: '100vh', background: 'white',
      borderRight: '1px solid #e2e8f0', padding: '20px 0',
      display: 'flex', flexDirection: 'column',
      position: 'fixed', top: 0, left: 0, zIndex: 50,
    }}>
      {/* ロゴ */}
      <div style={{ padding: '0 16px 20px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 20 }}>🔨</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>英語道場</div>
            <div style={{ fontSize: 10, color: '#94a3b8' }}>中学英語SRS</div>
          </div>
        </div>
      </div>

      {/* ナビゲーション */}
      <nav style={{ flex: 1, padding: '12px 8px' }}>
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <button key={item.href} onClick={() => router.push(item.href)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 10px', borderRadius: 10, marginBottom: 2,
                background: active ? '#eff6ff' : 'transparent',
                border: 'none', cursor: 'pointer',
                color: active ? '#1d4ed8' : '#64748b',
                fontWeight: active ? 600 : 400,
                fontSize: 13, textAlign: 'left',
                transition: 'all .15s',
              }}>
              <span style={{ fontSize: 16, width: 22, textAlign: 'center' }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {active && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6', flexShrink: 0 }} />}
            </button>
          )
        })}
      </nav>

      {/* フッター */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid #f1f5f9' }}>
        <button onClick={() => router.push('/logout')}
          style={{ width: '100%', padding: '8px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'white', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>
          ログアウト
        </button>
      </div>
    </div>
  )
}
