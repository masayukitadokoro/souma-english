import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { LEARNING_PLAN_SYSTEM, LEARNING_PLAN_PROMPT } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  const { goal, interests, scores, weakPoints } = await req.json()

  const raw = await callClaude(
    LEARNING_PLAN_SYSTEM,
    LEARNING_PLAN_PROMPT(goal, interests, scores, weakPoints),
    2000
  )

  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'プラン生成に失敗しました' }, { status: 500 })
  }
}
