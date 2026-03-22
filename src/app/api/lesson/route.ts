import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { type, topic, interests, goal, skillLevel, grade } = await req.json()

  const typeLabel: Record<string, string> = {
    vocabulary: '語彙・単語',
    grammar: '文法',
    conversation: '会話',
    communication: 'コミュニケーション',
  }

  const prompt = `
中学${grade || 1}年生向けの英語レッスンを作成してください。

レッスン情報：
- 種類：${typeLabel[type] || type}
- トピック：${topic}
- 生徒の興味：${interests?.join('、') || 'ものづくり'}
- 生徒の目標：${goal || '英語を話せるようになりたい'}
- レベル：${skillLevel || 1}/5

以下のJSON形式のみで返してください（前置き・説明・マークダウン不要）：

{
  "title": "レッスンタイトル",
  "skill": "${type}",
  "level": ${skillLevel || 1},
  "intro": "導入文（日本語・2文）",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "問題文（日本語）",
      "english": "英語フレーズ（あれば）",
      "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correct": 0,
      "hint": "ヒント（日本語）",
      "explanation": "解説（日本語・丁寧に）"
    }
  ],
  "summary": "まとめ（日本語・1文）",
  "completion_message": "完了メッセージ（励ます言葉）",
  "next_skill": "次に学ぶべきこと（1文）"
}

問題は必ず5問作成してください。questionsは必ず配列で返してください。
`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const block = response.content[0]
    const raw = block.type === 'text' ? block.text : ''
    const clean = raw.replace(/```json|```/g, '').trim()

    const jsonMatch = clean.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'JSON形式で返ってきませんでした' }, { status: 500 })
    }

    const data = JSON.parse(jsonMatch[0])

    if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
      return NextResponse.json({ error: 'questionsが空です' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('Lesson API error:', err)
    return NextResponse.json({ error: 'レッスン生成に失敗しました' }, { status: 500 })
  }
}
