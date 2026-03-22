import { NextRequest, NextResponse } from 'next/server'
import { callClaude } from '@/lib/claude'
import { DIAGNOSTIC_SYSTEM, DIAGNOSTIC_PROMPT } from '@/lib/prompts'

export async function POST(req: NextRequest) {
  const { goal, interests } = await req.json()

  const raw = await callClaude(
    DIAGNOSTIC_SYSTEM,
    DIAGNOSTIC_PROMPT(goal, interests),
    2000
  )

  try {
    const clean = raw.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: '診断テスト生成に失敗しました' }, { status: 500 })
  }
}
