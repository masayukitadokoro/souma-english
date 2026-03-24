import SidebarNav from '@/components/SidebarNav'
import PointToastContainer from '@/components/PointToast'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <SidebarNav />
      <PointToastContainer />
      <main className="pt-14 md:pt-0 md:ml-52">
        {children}
      </main>
    </div>
  )
}
