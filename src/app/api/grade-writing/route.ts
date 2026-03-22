import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { question, questionJp, answer, maxPoints } = await req.json()

    if (!answer || !answer.trim()) {
      return NextResponse.json({ score: 0, feedback: '回答が空です。', grammar: 0, content: 0, vocabulary: 0 })
    }

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are grading an English writing answer from a Japanese 7th grader (中学1年生). Be encouraging but fair.

Question: ${question}
Japanese instruction: ${questionJp || 'N/A'}
Student's answer: "${answer}"
Max points: ${maxPoints || 6}

Grade based on:
1. Grammar correctness (0-2 points) - Are be verbs used correctly? Is sentence structure correct?
2. Content relevance (0-2 points) - Does the answer address the question properly?
3. Vocabulary & spelling (0-2 points) - Are words spelled correctly? Is vocabulary appropriate?

Respond ONLY with a JSON object (no markdown, no backticks):
{"score":number,"feedback":"feedback in Japanese (2-3 sentences, encouraging tone)","grammar":number,"content":number,"vocabulary":number}`
      }]
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)

    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Grade writing error:', e)
    return NextResponse.json(
      { score: 0, feedback: 'AI採点でエラーが発生しました。', grammar: 0, content: 0, vocabulary: 0 },
      { status: 500 }
    )
  }
}
