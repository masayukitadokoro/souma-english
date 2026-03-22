const API_KEY = process.env.ANTHROPIC_API_KEY
if (!API_KEY) { console.error('ANTHROPIC_API_KEY が未設定'); process.exit(1) }

const UNITS = [
  { id: 'g1-01', title: 'アルファベット・発音の基礎', description: '大文字・小文字、フォニックスの基礎' },
  { id: 'g1-02', title: 'be動詞（am/is/are）', description: '主語によってbe動詞が変わる' },
  { id: 'g1-03', title: 'be動詞の否定文・疑問文', description: 'am not / is not / are not' },
]

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: `中学生向け英語教師。ルール：大工・宮大工になりたい生徒向けに例文を作る。文法用語を使わず直感的に説明。JSONのみ返す。`,
    messages: [{ role: 'user', content: `以下3項目の解説をJSON形式で作成。

${JSON.stringify(UNITS)}

形式:
{"explanations":[{"id":"g1-01","intro":"直感的な一言(60字)","explanation":"解説(200字)","examples":[{"en":"英文","ja":"訳","note":"ポイント"},{"en":"英文","ja":"訳","note":"ポイント"},{"en":"英文","ja":"訳","note":"ポイント"}],"tip":"覚えるコツ(60字)"}]}` }],
  })
})
const data = await res.json()
if (data.error) { console.error(data.error.message); process.exit(1) }
const text = data.content[0].text
const clean = text.replace(/```json|```/g, '').trim()
const result = JSON.parse(clean)

for (const exp of result.explanations) {
  console.log(`\n${'='.repeat(50)}`)
  console.log(`【${exp.id}】${exp.title || ''}`)
  console.log(`💡 ${exp.intro}`)
  console.log(`\n📖 ${exp.explanation}`)
  console.log('\n📝 例文:')
  exp.examples.forEach((e,i) => {
    console.log(`  ${i+1}. ${e.en}`)
    console.log(`     ${e.ja}`)
    console.log(`     → ${e.note}`)
  })
  console.log(`\n🎯 コツ: ${exp.tip}`)
}

import { writeFileSync } from 'fs'
writeFileSync('grammar_explanations_test.json', JSON.stringify(result, null, 2), 'utf8')
console.log('\n\n✅ grammar_explanations_test.json に保存完了')
