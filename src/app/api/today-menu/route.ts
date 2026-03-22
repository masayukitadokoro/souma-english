import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import syllabusData from '@/data/syllabus.json'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const {
    goal, interests, grade = 1,
    vocabStats, grammarStats, diagnosticScores
  } = await req.json()

  const grammarUnits = (syllabusData.syllabus.grammar as any).levels
    .filter((l: any) => l.level <= grade + 1)
    .flatMap((l: any) => l.units || [])
    .slice(0, 10)
    .map((u: any) => `${u.id}: ${u.title}`)
    .join('\n')

  const prompt = `
あなたは中学生の英語学習AIコーチです。以下の生徒情報をもとに、今日の学習メニューを作成してください。

生徒情報：
- 目標：${goal}
- 興味：${interests?.join('、')}
- 学年：中学${grade}年生
- 診断スコア：単語${diagnosticScores?.vocab || 0}/4、文法${diagnosticScores?.grammar || 0}/4、読解${diagnosticScores?.reading || 0}/4
- 単語学習済み：${vocabStats?.mastered || 0}語、復習待ち：${vocabStats?.review || 0}語
- 文法習得済み：${grammarStats?.mastered || 0}項目、復習待ち：${grammarStats?.review || 0}項目

利用可能な文法項目：
${grammarUnits}

以下のJSON形式のみで返してください：
{
  "greeting": "今日の一言メッセージ（生徒の目標に絡めて励ます・日本語・1文）",
  "today_focus": "今日のフォーカステーマ（例：木工英語で基礎固め）",
  "menu": [
    {
      "type": "vocab",
      "title": "今日の単語レッスン",
      "description": "説明（何語・どんな単語）",
      "duration_min": 10,
      "priority": 1,
      "url": "/vocab"
    },
    {
      "type": "grammar",
      "grammar_id": "g1-1",
      "title": "文法レッスン：be動詞",
      "description": "説明（なぜ今日これをやるか）",
      "duration_min": 10,
      "priority": 2,
      "url": "/grammar?id=g1-1"
    },
    {
      "type": "lesson",
      "title": "会話練習",
      "description": "説明",
      "duration_min": 10,
      "priority": 3,
      "url": "/lesson?type=conversation&topic=自己紹介"
    }
  ],
  "total_duration_min": 30,
  "motivation_tip": "今日頑張るための一言（日本語・短く）"
}
`

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    })
    const block = response.content[0]
    const raw = block.type === 'text' ? block.text : ''
    const jsonMatch = raw.replace(/```json|```/g, '').trim().match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON not found')
    return NextResponse.json(JSON.parse(jsonMatch[0]))
  } catch (err) {
    console.error('Today menu error:', err)
    return NextResponse.json({
      greeting: '今日も一緒に頑張ろう！',
      today_focus: '基礎固め',
      menu: [
        { type: 'vocab', title: '今日の単語レッスン', description: '10語を学ぼう', duration_min: 10, priority: 1, url: '/vocab' },
        { type: 'grammar', grammar_id: 'g1-1', title: 'be動詞の使い方', description: 'am/is/areをマスターしよう', duration_min: 10, priority: 2, url: '/grammar?id=g1-1' },
        { type: 'lesson', title: '読解練習', description: '短い文章を読もう', duration_min: 10, priority: 3, url: '/lesson?type=reading&topic=基本読解' },
      ],
      total_duration_min: 30,
      motivation_tip: '一歩ずつ、着実に前進！',
    })
  }
}
