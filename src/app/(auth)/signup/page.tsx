'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'student' | 'parent'>('student')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: signupError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } },
    })

    if (signupError) {
      setError(signupError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      router.push('/onboarding')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔨</div>
          <h1 className="text-2xl font-bold text-gray-800">英語、はじめよう</h1>
          <p className="text-gray-500 text-sm mt-1">夢に向かって、一歩ずつ</p>
        </div>

        <div className="flex gap-3 mb-6">
          <button
            type="button"
            onClick={() => setRole('student')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
              role === 'student'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-500'
            }`}
          >
            📚 生徒として登録
          </button>
          <button
            type="button"
            onClick={() => setRole('parent')}
            className={`flex-1 py-3 rounded-xl text-sm font-medium border-2 transition-all ${
              role === 'parent'
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-gray-200 text-gray-500'
            }`}
          >
            👨‍👩‍👦 保護者として登録
          </button>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
              placeholder="example@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
              placeholder="8文字以上"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? '登録中...' : 'アカウントを作る'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          すでにアカウントをお持ちですか？{' '}
          <Link href="/login" className="text-indigo-600 font-medium hover:underline">
            ログイン
          </Link>
        </p>
      </div>
    </div>
  )
}
