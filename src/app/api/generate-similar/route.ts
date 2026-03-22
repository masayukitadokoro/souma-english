import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { question_text, question_text_jp, correct_answer, question_type, category, explanation_jp } = await req.json()

    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: `You are creating a similar English practice question for a Japanese 7th grader.

Original question:
- Type: ${question_type}
- Category: ${category}
- Question: ${question_text}
- Japanese: ${question_text_jp || 'N/A'}
- Answer: ${correct_answer}
- Explanation: ${explanation_jp || 'N/A'}

Create ONE similar question that tests the same grammar pattern or vocabulary category but uses DIFFERENT words/subjects. Keep the same difficulty level.

Rules:
- For fill_blank/multiple_choice: use the same grammar pattern (e.g., if original tests "She ___ my friend" with "is", create "He ___ my brother" with "is")
- For vocab_jp_en: use a different word from the same category
- For vocab_en_jp: use a different word from the same category  
- For writing: create a similar translation or writing task with different content
- The question must be appropriate for 中学1年生

Respond ONLY with JSON (no markdown, no backticks):
{"question_text":"the question in English","question_text_jp":"Japanese instruction","correct_answer":"the answer","explanation_jp":"brief explanation in Japanese"}`
      }]
    })

    const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const result = JSON.parse(clean)
    return NextResponse.json(result)
  } catch (e: any) {
    console.error('Generate similar error:', e)
    return NextResponse.json({ error: 'Failed to generate' }, { status: 500 })
  }
}
