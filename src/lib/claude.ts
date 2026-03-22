import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 1000
) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userMessage }],
    system: systemPrompt,
  })
  const block = response.content[0]
  return block.type === 'text' ? block.text : ''
}
