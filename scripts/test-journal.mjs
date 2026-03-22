import Anthropic from '@anthropic-ai/sdk'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const apiKey = env.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim()
const client = new Anthropic({ apiKey })

const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 500,
  system: `あなたはソウマくんの英語学習コーチ「タクミ先生」です。必ずJSON形式のみで返す。前後に説明文を書かない。
通常の会話: {"message":"メッセージ","choices":null,"step":"chat"}`,
  messages: [{ role: 'user', content: 'こんにちは' }],
})

const text = response.content[0].type === 'text' ? response.content[0].text : ''
console.log('RAW:', JSON.stringify(text))
try {
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim())
  console.log('OK:', parsed)
} catch(e) {
  console.log('PARSE ERROR:', e.message)
}
