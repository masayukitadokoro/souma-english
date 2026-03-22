'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function LogoutPage() {
  const router = useRouter()
  useEffect(() => {
    supabase.auth.signOut().then(() => router.push('/signup'))
  }, [router])
  return <div className="p-8 text-center text-gray-500">ログアウト中...</div>
}
