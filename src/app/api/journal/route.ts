import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, profile, pastJournals, mode, studyStats } = await req.json()
    const today = new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'long' })
    const recentGoals = pastJournals?.slice(0, 3).map((j: any) => j.today_goal).filter(Boolean).join('、') || 'なし'
    const recentChallenges = pastJournals?.slice(0, 5).map((j: any) => j.challenge).filter(Boolean).join('、') || 'なし'

    if (mode === 'closing') {
      const conversationText = messages.map((m: any) => `${m.role === 'user' ? 'ソウマ' : 'タクミ先生'}: ${m.content}`).join('\n')
      const closingPrompt = `あなたはソウマくんの英語学習コーチ「タクミ先生」です。

生徒: ${profile?.name || 'ソウマ'}、中学${profile?.grade || 1}年生、夢: ${profile?.goal || '宮大工'}

今日の会話:
${conversationText}

過去の課題: ${recentChallenges}
過去の目標: ${recentGoals}
苦手な単語: ${studyStats?.weakWords?.join('、') || 'なし'}
最後に学習した文法: ${studyStats?.lastGrammar || 'なし'}

以下のJSON形式のみで返す（前後に説明文不要）:
{"message":"励ましの言葉と今日最初にやること1つを具体的に。2〜3文。宮大工の夢に絡めて。","action":"具体的なアクション名","actionUrl":"/vocab-typing","choices":null,"step":"done"}

actionUrlは /vocab-typing または /grammar-map または /vocab または /lesson から選ぶ。JSONのみ返す。`

      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 400,
        messages: [{ role: 'user', content: closingPrompt }],
      })
      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      const data = JSON.parse(text.replace(/```json|```/g, '').trim())
      return NextResponse.json(data)
    }

    const systemPrompt = `あなたはソウマくんの英語学習コーチ「タクミ先生」です。今日は${today}。

生徒: ${profile?.name || 'ソウマ'}、中学${profile?.grade || 1}年生、夢: ${profile?.goal || '宮大工'}
最近の目標: ${recentGoals}

会話の流れ:
- まずアイスブレーク1〜2回（昨日何した？好きなことは？など日常的な質問）
- 次に英語を学ぶ理由を確認（5択）
- 次に今の課題を確認（5択）
- 次に今日やることを確認（5択）

選択肢が必要な場面は必ずこの形式:
{"message":"メッセージ","choices":["選択肢1","選択肢2","選択肢3","選択肢4","自分で書く"],"step":"motivation"}
stepは motivation / challenge / goal のいずれか。

通常の会話はこの形式:
{"message":"メッセージ","choices":null,"step":"chat"}

ルール: 中学生らしい親しみやすい言葉、1回3文以内、JSONのみ返す（前後に説明文不要）`

    // messagesが空の場合は最初の挨拶
    const apiMessages = messages.length > 0
      ? messages.map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      : [{ role: 'user' as const, content: '今日もよろしくお願いします' }]

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: apiMessages,
    })
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const data = JSON.parse(text.replace(/```json|```/g, '').trim())
    return NextResponse.json(data)
  } catch (e: any) {
    console.error('journal API error:', e)
    return NextResponse.json({ message: 'おはよう！今日も一緒に頑張ろう！', choices: null, step: 'chat' })
  }
}
