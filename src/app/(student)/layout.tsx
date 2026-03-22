import SidebarNav from '@/components/SidebarNav'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SidebarNav />
      {/* モバイル: トップバー分のpt-14, PC: サイドバー分のml-52 */}
      <main className="pt-14 md:pt-0 md:ml-52">
        {children}
      </main>
    </div>
  )
}
