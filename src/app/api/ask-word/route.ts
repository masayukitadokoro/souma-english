import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { word, translation, question } = await req.json()

  const prompt = `
中学生が英単語「${word}（${translation}）」について質問しています。
質問：「${question}」

以下のルールで答えてください：
- 日本語で答える
- 中学生にわかりやすく
- 例文を1つ含める
- 3-4文以内で簡潔に
`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    const answer = block.type === 'text' ? block.text : ''
    return NextResponse.json({ answer })
  } catch {
    return NextResponse.json({ answer: '申し訳ありません、うまく答えられませんでした。' })
  }
}
