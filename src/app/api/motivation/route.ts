import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { MOTIVATION_PROMPT } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  const { goal, interests } = await req.json()

  const raw = await callClaude(
    'あなたは中学1年生向けの英語学習モチベーターです。必ずJSON形式のみで返答してください。',
    MOTIVATION_PROMPT(goal, interests),
    1500
  )

  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'コンテンツ生成に失敗しました' }, { status: 500 })
  }
}
