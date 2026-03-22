import { readFileSync } from 'fs'

// .env.local から環境変数を読み込む
const env = readFileSync('.env.local', 'utf8')
env.split('\n').forEach(line => {
  const [key, ...vals] = line.split('=')
  if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
})

const API_KEY = process.env.ANTHROPIC_API_KEY
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

console.log('Supabase URL:', SUPABASE_URL ? '✅' : '❌')
console.log('Supabase KEY:', SUPABASE_KEY ? '✅' : '❌')
console.log('Anthropic KEY:', API_KEY ? '✅' : '❌')

const TOP5 = [
  { id: 'g1-01', title: 'アルファベット・発音の基礎', description: '大文字・小文字、フォニックスの基礎' },
  { id: 'g1-02', title: 'be動詞①（am/is/are）', description: '「〜です」「〜にいます」の基本' },
  { id: 'g1-03', title: 'be動詞②（否定文・疑問文）', description: 'am not / is not / are not / Are you〜?' },
  { id: 'g1-04', title: '一般動詞①（肯定文）', description: 'play, like, have などの動詞の使い方' },
  { id: 'g1-05', title: '一般動詞②（否定文・疑問文）', description: "don't / does not / Do you〜? / Does he〜?" },
]

async function generateOne(unit) {
  const prompt = `中学1年生（夢：宮大工になる、興味：宮大工・ものづくり・木工・職人）向けに英文法を教えてください。

文法項目: ${unit.title}
説明: ${unit.description}

【重要ルール】
- 文法用語には必ず（）で日本語説明を付ける
  例：主語（文の主役）、述語（主語の動作を表す言葉）、be動詞（am/is/areのこと）、
      肯定文（「〜です」という普通の文）、否定文（「〜ではない」という文）、
      疑問文（「〜ですか？」と聞く文）
- 例文は全て大工・宮大工・職人テーマ
- JSONのみ返す

{"why":"なぜ必要か60字","cards":[{"subject":"I","subject_ja":"私は","verb":"am","color":"teal","examples":[{"en":"I am a shrine carpenter.","ja":"私は宮大工です。","note":"主語（文の主役）がIのときは必ずam"},{"en":"I am in the workshop.","ja":"私は作業場にいます。","note":"場所を表すときもam"},{"en":"I am not a beginner.","ja":"私は初心者ではありません。","note":"否定文（「〜ではない」）はam+not"}]},{"subject":"He / She / It","subject_ja":"彼・彼女・それは","verb":"is","color":"purple","examples":[{"en":"He is my master.","ja":"彼は師匠です。","note":"1人の他人が主語（文の主役）のときはis"},{"en":"This wood is hinoki.","ja":"この木は檜です。","note":"物が主語のときもis"},{"en":"Is she a carpenter?","ja":"彼女は大工ですか？","note":"疑問文（「〜ですか？」）はisを文頭へ"}]},{"subject":"You / We / They","subject_ja":"あなた・私たち・彼らは","verb":"are","color":"amber","examples":[{"en":"We are carpenters.","ja":"私たちは大工です。","note":"複数が主語のときはare"},{"en":"You are skilled.","ja":"あなたは熟練です。","note":"相手に話すときもare"},{"en":"They are not beginners.","ja":"彼らは初心者ではありません。","note":"aren'tはare notの短縮形（縮めた形）"}]}],"transform":{"base":"He is a carpenter.","negative":{"en":"He is not a carpenter.","ja":"彼は大工ではありません。","rule":"否定文（「〜ではない」）：be動詞（am/is/are）の後にnotを置く"},"question":{"en":"Is he a carpenter?","ja":"彼は大工ですか？","rule":"疑問文（「〜ですか？」）：be動詞（am/is/are）を文の先頭に移動"}},"tip":"覚えるコツ60字","contractions":[{"long":"is not","short":"isn't","note":"短縮形（縮めた形）"},{"long":"are not","short":"aren't","note":"短縮形"},{"long":"am not","short":"短縮形なし","note":"am notは短縮できない（例外）"}]}

※文法項目に合わせてcardsの内容を適切に変えること。be動詞以外はcardsをその文法のパターンに合わせること。`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  const clean = data.content[0].text.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}

async function saveToSupabase(grammarId, grade, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/grammar_explanations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({ grammar_id: grammarId, grade, data }),
  })
  if (!res.ok) throw new Error(await res.text())
}

console.log('\n🚀 最初の5項目を生成してSupabaseにキャッシュします\n')
for (const unit of TOP5) {
  console.log(`⏳ [${unit.id}] ${unit.title} を生成中...`)
  try {
    const data = await generateOne(unit)
    await saveToSupabase(unit.id, 1, data)
    console.log(`✅ [${unit.id}] 完了！cards: ${data.cards?.length}個`)
    await new Promise(r => setTimeout(r, 800))
  } catch (e) {
    console.error(`❌ [${unit.id}] エラー:`, e.message)
  }
}
console.log('\n🎉 完了！文法マップで即座に表示されます')
