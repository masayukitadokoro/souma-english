import SidebarNav from '@/components/SidebarNav'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <SidebarNav />
      <main style={{ marginLeft: '200px', flex: 1, minWidth: 0 }}>
        {children}
      </main>
    </div>
  )
}
