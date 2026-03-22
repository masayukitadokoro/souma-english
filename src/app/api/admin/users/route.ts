import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = ['masa@unicornfarm.co', 'moe7120028@gmail.com']

function getServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest) {
  const supabase = getServiceClient()

  // 認証チェック
  const authHeader = req.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
  if (authErr || !user || !ADMIN_EMAILS.includes(user.email || '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const userId = req.nextUrl.searchParams.get('userId')

  // ─── 個別ユーザー詳細 ───
  if (userId) {
    const [drillRes, answersRes] = await Promise.all([
      supabase.from('drill_records').select('*').eq('user_id', userId).order('completed_at', { ascending: false }),
      supabase.from('answers').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
    ])

    // テストセッション集計
    const answers = answersRes.data || []
    const sessionMap: Record<string, any> = {}
    answers.forEach((a: any) => {
      const sid = a.session_id || a.id
      if (!sessionMap[sid]) {
        sessionMap[sid] = { session_id: sid, date: a.created_at, answers: [], score: 0, total: 0 }
      }
      sessionMap[sid].answers.push(a)
      sessionMap[sid].total++
      if (a.is_correct) sessionMap[sid].score++
    })
    const sessions = Object.values(sessionMap)
      .map((s: any) => ({ ...s, pct: s.total > 0 ? Math.round((s.score / s.total) * 100) : 0 }))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())

    return NextResponse.json({
      drillRecords: drillRes.data || [],
      testSessions: sessions,
    })
  }

  // ─── ユーザー一覧 ───
  const { data: authUsers } = await supabase.auth.admin.listUsers({ perPage: 100 })
  const users = authUsers?.users || []

  // 全ドリル記録と回答を取得
  const [drillRes, answersRes] = await Promise.all([
    supabase.from('drill_records').select('user_id, duration_seconds, completed_at, drill_mode, correct_count, total_count'),
    supabase.from('answers').select('user_id, is_correct, session_id, created_at'),
  ])
  const drills = drillRes.data || []
  const answers = answersRes.data || []

  // ユーザーごとの集計
  const userSummaries = users.map((u: any) => {
    const userDrills = drills.filter((d: any) => d.user_id === u.id)
    const userAnswers = answers.filter((a: any) => a.user_id === u.id)

    const totalDrills = userDrills.length
    const totalSeconds = userDrills.reduce((s: number, d: any) => s + (d.duration_seconds || 0), 0)
    const totalQuestions = userDrills.reduce((s: number, d: any) => s + (d.total_count || 0), 0)
    const totalCorrect = userDrills.reduce((s: number, d: any) => s + (d.correct_count || 0), 0)

    // テストセッション数と最新スコア
    const sessionIds = new Set(userAnswers.map((a: any) => a.session_id).filter(Boolean))
    const testCount = sessionIds.size
    const correctAnswers = userAnswers.filter((a: any) => a.is_correct).length
    const testPct = userAnswers.length > 0 ? Math.round((correctAnswers / userAnswers.length) * 100) : 0

    // 最終アクティビティ
    const lastDrill = userDrills[0]?.completed_at || null
    const lastTest = userAnswers[0]?.created_at || null
    const lastActive = [lastDrill, lastTest].filter(Boolean).sort().pop() || null

    return {
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_active: lastActive,
      total_drills: totalDrills,
      total_seconds: totalSeconds,
      total_questions: totalQuestions,
      total_correct: totalCorrect,
      test_count: testCount,
      test_pct: testPct,
    }
  })

  return NextResponse.json({ users: userSummaries })
}
