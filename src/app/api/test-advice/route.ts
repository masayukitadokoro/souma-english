import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { score, analysis, wrongAnswers, level } = await req.json()

    const wrongSummary = wrongAnswers
      .map((w: any) => `- 問題「${w.question}」(${w.type}/${w.category}) → 生徒の回答「${w.answer || '未回答'}」正答「${w.correct || 'AI採点'}」`)
      .join('\n')

    const catSummary = analysis.byCategory
      .map((c: any) => `${c.label}: ${c.pct}% (${c.earned}/${c.total})`)
      .join(', ')

    const skillSummary = analysis.bySkill
      .map((s: any) => `${s.label}: ${s.pct}% (${s.earned}/${s.total})`)
      .join(', ')

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `あなたは中学1年生の英語の先生です。生徒のテスト結果を分析して、具体的で実践的なアドバイスを日本語で書いてください。

テスト情報:
- レベル: ${level}
- スコア: ${score}/100点
- カテゴリ別: ${catSummary}
- スキル別: ${skillSummary}

間違えた問題:
${wrongSummary}

以下のルールで回答してください:
1. まず1文で全体の印象（褒める部分があれば褒める）
2. 間違いのパターンを具体的に指摘（例:「主語がWeやTheyの時にareではなくisを選んでいます」）
3. 最後に具体的な練習方法を1-2つ提案（例:「主語を見たらまず単数か複数かを判断する練習をしましょう」）

全体で150字以内で、励ましのトーンで書いてください。箇条書きではなく自然な文章で。`
      }]
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    return NextResponse.json({ advice: text })
  } catch (e: any) {
    console.error('Test advice error:', e)
    return NextResponse.json({ advice: '' }, { status: 500 })
  }
}
