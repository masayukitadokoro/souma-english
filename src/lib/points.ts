import { supabase } from '@/lib/supabase'

// ─── ポイント付与（dedup_keyで重複防止） ───
export async function awardPoints({
  eventType,
  points,
  description,
  dedupKey,
  metadata,
}: {
  eventType: string
  points: number
  description: string
  dedupKey?: string
  metadata?: Record<string, unknown>
}): Promise<{ awarded: boolean; points: number }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { awarded: false, points: 0 }

  const { error } = await supabase.from('point_events').insert({
    user_id: user.id,
    event_type: eventType,
    points,
    description,
    dedup_key: dedupKey || null,
    metadata: metadata || {},
  })

  if (error) {
    // dedup_keyの重複 → 既に付与済み
    if (error.code === '23505') return { awarded: false, points: 0 }
    console.error('Point award error:', error)
    return { awarded: false, points: 0 }
  }

  return { awarded: true, points }
}

// ─── テスト完了時のポイント付与 ───
export async function awardTestPoints(sessionId: string, scorePercent: number) {
  const today = new Date().toLocaleDateString('ja-JP')
  const results: { type: string; pts: number; awarded: boolean }[] = []

  // テスト受験ポイント
  const base = await awardPoints({
    eventType: 'test_complete',
    points: 30,
    description: '実力テスト受験',
    dedupKey: `test_complete:${sessionId}`,
  })
  results.push({ type: 'test_complete', pts: 30, awarded: base.awarded })

  // スコアボーナス（最大のもののみ）
  if (scorePercent >= 100) {
    const r = await awardPoints({
      eventType: 'test_score_100',
      points: 50,
      description: '満点ボーナス',
      dedupKey: `test_score_100:${sessionId}`,
    })
    results.push({ type: 'test_score_100', pts: 50, awarded: r.awarded })
  } else if (scorePercent >= 90) {
    const r = await awardPoints({
      eventType: 'test_score_90',
      points: 20,
      description: '90%以上ボーナス',
      dedupKey: `test_score_90:${sessionId}`,
    })
    results.push({ type: 'test_score_90', pts: 20, awarded: r.awarded })
  } else if (scorePercent >= 80) {
    const r = await awardPoints({
      eventType: 'test_score_80',
      points: 10,
      description: '80%以上ボーナス',
      dedupKey: `test_score_80:${sessionId}`,
    })
    results.push({ type: 'test_score_80', pts: 10, awarded: r.awarded })
  }

  return results
}

// ─── ドリル完了時のポイント付与 ───
export async function awardDrillPoints(drillId: string) {
  const today = new Date().toLocaleDateString('ja-JP')
  return awardPoints({
    eventType: 'drill_complete',
    points: 15,
    description: 'ドリル完了',
    dedupKey: `drill_complete:${today}:${drillId}`,
  })
}

// ─── スペル練習完了時のポイント付与 ───
export async function awardSpellingPoints(level: number, correctCount: number, totalCount: number) {
  const today = new Date().toLocaleDateString('ja-JP')
  const results: { type: string; pts: number; awarded: boolean }[] = []

  // 練習完了ポイント
  const base = await awardPoints({
    eventType: 'spelling_complete',
    points: 20,
    description: `スペル練習 Lv${level} 完了`,
    dedupKey: `spelling_complete:${today}:lv${level}`,
  })
  results.push({ type: 'spelling_complete', pts: 20, awarded: base.awarded })

  // レベル初回クリアボーナス（正答率70%以上で「クリア」）
  if (correctCount / totalCount >= 0.7) {
    const r = await awardPoints({
      eventType: 'level_clear_spelling',
      points: 50,
      description: `スペル練習 Lv${level} 初回クリア`,
      dedupKey: `level_clear_spelling:lv${level}`,
      metadata: { level, correctCount, totalCount },
    })
    results.push({ type: 'level_clear_spelling', pts: 50, awarded: r.awarded })
  }

  return results
}

// ─── 単語練習完了時のポイント付与 ───
export async function awardVocabPoints(level: number, correctCount: number, totalCount: number) {
  const today = new Date().toLocaleDateString('ja-JP')
  const results: { type: string; pts: number; awarded: boolean }[] = []

  const base = await awardPoints({
    eventType: 'vocab_complete',
    points: 20,
    description: `単語練習 Lv${level} 完了`,
    dedupKey: `vocab_complete:${today}:lv${level}`,
  })
  results.push({ type: 'vocab_complete', pts: 20, awarded: base.awarded })

  if (correctCount / totalCount >= 0.7) {
    const r = await awardPoints({
      eventType: 'level_clear_vocab',
      points: 50,
      description: `単語練習 Lv${level} 初回クリア`,
      dedupKey: `level_clear_vocab:lv${level}`,
      metadata: { level, correctCount, totalCount },
    })
    results.push({ type: 'level_clear_vocab', pts: 50, awarded: r.awarded })
  }

  return results
}

// ─── 日次ボーナス（時間・幅広さ）チェック＆付与 ───
export async function checkAndAwardDailyBonuses() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const today = new Date()
  const todayStr = today.toLocaleDateString('ja-JP')
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()

  // 今日のdrill_recordsを取得
  const { data: records } = await supabase
    .from('drill_records')
    .select('drill_mode, duration_seconds')
    .eq('user_id', user.id)
    .gte('completed_at', startOfDay)
    .lt('completed_at', endOfDay)

  if (!records || records.length === 0) return []

  const results: { type: string; pts: number; awarded: boolean }[] = []

  // 時間ボーナス
  const totalSeconds = records.reduce((sum, r) => sum + (r.duration_seconds || 0), 0)
  const totalMinutes = totalSeconds / 60

  if (totalMinutes >= 60) {
    const r = await awardPoints({
      eventType: 'time_bonus_60',
      points: 40,
      description: '60分以上学習ボーナス',
      dedupKey: `time_bonus_60:${todayStr}`,
    })
    results.push({ type: 'time_bonus_60', pts: 40, awarded: r.awarded })
  } else if (totalMinutes >= 30) {
    const r = await awardPoints({
      eventType: 'time_bonus_30',
      points: 20,
      description: '30分以上学習ボーナス',
      dedupKey: `time_bonus_30:${todayStr}`,
    })
    results.push({ type: 'time_bonus_30', pts: 20, awarded: r.awarded })
  }

  // まんべんなくボーナス
  const modes = new Set(records.map(r => {
    if (r.drill_mode === 'spelling_practice') return 'spelling'
    if (r.drill_mode === 'vocab_practice') return 'vocab'
    if (['spelling', 'grammar', 'write3', 'flashcard', 'dictation', 'reorder'].includes(r.drill_mode)) return 'drill'
    return r.drill_mode
  }))

  // test_sessionsも確認
  const { data: testSessions } = await supabase
    .from('test_sessions')
    .select('id')
    .eq('user_id', user.id)
    .gte('started_at', startOfDay)
    .lt('started_at', endOfDay)
    .limit(1)

  if (testSessions && testSessions.length > 0) modes.add('test')

  if (modes.size >= 3) {
    const r = await awardPoints({
      eventType: 'breadth_3',
      points: 20,
      description: '3種類以上学習ボーナス',
      dedupKey: `breadth_3:${todayStr}`,
    })
    results.push({ type: 'breadth_3', pts: 20, awarded: r.awarded })
  } else if (modes.size >= 2) {
    const r = await awardPoints({
      eventType: 'breadth_2',
      points: 10,
      description: '2種類以上学習ボーナス',
      dedupKey: `breadth_2:${todayStr}`,
    })
    results.push({ type: 'breadth_2', pts: 10, awarded: r.awarded })
  }

  return results
}

// ─── ストリークボーナスチェック＆付与 ───
export async function checkAndAwardStreakBonuses() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  // 今月のdrill_recordsから日付一覧を取得
  const { data: records } = await supabase
    .from('drill_records')
    .select('completed_at')
    .eq('user_id', user.id)
    .gte('completed_at', monthStart)
    .order('completed_at', { ascending: true })

  if (!records || records.length === 0) return []

  // ユニークな日付を抽出
  const uniqueDays = new Set(
    records.map(r => {
      const d = new Date(r.completed_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  // 連続日数を計算（今日から遡る）
  let streak = 0
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  for (let i = 0; i < 31; i++) {
    const checkDate = new Date(today)
    checkDate.setDate(checkDate.getDate() - i)
    const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`
    if (uniqueDays.has(key)) {
      streak++
    } else {
      break
    }
  }

  const monthStr = `${now.getFullYear()}-${now.getMonth() + 1}`
  const results: { type: string; pts: number; awarded: boolean }[] = []

  const milestones = [
    { days: 3, type: 'streak_3', pts: 50, desc: '3日連続学習' },
    { days: 7, type: 'streak_7', pts: 100, desc: '7日連続学習' },
    { days: 14, type: 'streak_14', pts: 200, desc: '14日連続学習' },
    { days: 21, type: 'streak_21', pts: 300, desc: '21日連続学習' },
  ]

  for (const m of milestones) {
    if (streak >= m.days) {
      const r = await awardPoints({
        eventType: m.type,
        points: m.pts,
        description: m.desc,
        dedupKey: `${m.type}:${monthStr}`,
      })
      results.push({ type: m.type, pts: m.pts, awarded: r.awarded })
    }
  }

  // 月間皆勤
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  if (uniqueDays.size >= daysInMonth) {
    const r = await awardPoints({
      eventType: 'streak_full',
      points: 500,
      description: '月間皆勤ボーナス',
      dedupKey: `streak_full:${monthStr}`,
    })
    results.push({ type: 'streak_full', pts: 500, awarded: r.awarded })
  }

  return results
}

// ─── 今月のポイント合計を取得 ───
export async function getMonthlyPoints(): Promise<{
  total: number
  events: { event_type: string; points: number; description: string; created_at: string }[]
}> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { total: 0, events: [] }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString()

  const { data, error } = await supabase
    .from('point_events')
    .select('event_type, points, description, created_at')
    .eq('user_id', user.id)
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)
    .order('created_at', { ascending: false })

  if (error || !data) return { total: 0, events: [] }

  const total = data.reduce((sum, e) => sum + e.points, 0)
  return { total, events: data }
}
