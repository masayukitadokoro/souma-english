import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { unitId, title, description, grade, interests, goal } = await req.json()

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
    )

    // キャッシュ確認
    const { data: cached } = await supabase
      .from('grammar_explanations')
      .select('data')
      .eq('grammar_id', unitId)
      .single()

    if (cached?.data) {
      return NextResponse.json({ ...cached.data, cached: true })
    }

    // 新規生成
    const interestText = interests?.includes('woodworking') || interests?.includes('crafts')
      ? '宮大工・ものづくり・木工・職人'
      : interests?.join('・') || 'ものづくり'

    const prompt = `中学${grade || 1}年生（夢：${goal || '宮大工になる'}、興味：${interestText}）向けに英文法を教えてください。

文法項目: ${title}
説明: ${description}

【重要ルール】
- 文法用語を使う場合は必ず（）で日本語説明を付ける
  例：主語（文の主役・"誰が"にあたる言葉）、述語（主語の動作や状態を表す言葉）、
      be動詞（am/is/areのこと。「〜です・〜にいます」を表す）、
      肯定文（「〜です」という普通の文）、否定文（「〜ではない」という文）、
      疑問文（「〜ですか？」と聞く文）、三単現（主語が1人・1つの他人のとき）
- 例文は全て大工・宮大工・職人・ものづくりテーマ
- 中学1年生が読める言葉で書く
- JSONのみ返す

【フォーマット】
{
  "why": "なぜこの表現が必要か。海外の職人・宮大工の文脈で60字以内",
  "image_prompt": "主語ごとの使い分けを示すインタラクティブカードの内容",
  "cards": [
    {
      "subject": "I",
      "subject_ja": "私は",
      "verb": "am",
      "color": "teal",
      "examples": [
        {"en": "I am a shrine carpenter.", "ja": "私は宮大工です。", "note": "主語（文の主役）がIのときは必ずam"},
        {"en": "I am in the workshop.", "ja": "私は作業場にいます。", "note": "場所を表すときもamを使う"},
        {"en": "I am not a beginner.", "ja": "私は初心者ではありません。", "note": "否定文（「〜ではない」という文）はam + not"}
      ]
    },
    {
      "subject": "He / She / It",
      "subject_ja": "彼・彼女・それは",
      "verb": "is",
      "color": "purple",
      "examples": [
        {"en": "He is my master.", "ja": "彼は私の師匠です。", "note": "主語（文の主役）が1人の他人のときはis"},
        {"en": "This wood is hinoki.", "ja": "この木は檜です。", "note": "物（ひとつのもの）が主語のときもis"},
        {"en": "Is she a carpenter?", "ja": "彼女は大工ですか？", "note": "疑問文（「〜ですか？」という文）はisを文の先頭へ"}
      ]
    },
    {
      "subject": "You / We / They",
      "subject_ja": "あなた・私たち・彼らは",
      "verb": "are",
      "color": "amber",
      "examples": [
        {"en": "We are carpenters.", "ja": "私たちは大工です。", "note": "複数（2人以上）が主語のときはare"},
        {"en": "You are skilled.", "ja": "あなたは熟練しています。", "note": "相手（you）に話しかけるときもare"},
        {"en": "They are not beginners.", "ja": "彼らは初心者ではありません。", "note": "aren'tはare notの短縮形（縮めた形）"}
      ]
    }
  ],
  "transform": {
    "base": "He is a carpenter.",
    "negative": {"en": "He is not a carpenter.", "ja": "彼は大工ではありません。", "rule": "否定文（「〜ではない」）：be動詞（am/is/are）の後にnotを置く"},
    "question": {"en": "Is he a carpenter?", "ja": "彼は大工ですか？", "rule": "疑問文（「〜ですか？」）：be動詞（am/is/are）を文の先頭に移動させる"}
  },
  "tip": "大工道具と同じ！主語（文の主役）を見てam・is・areを選ぼう。60字以内",
  "contractions": [
    {"long": "is not", "short": "isn't", "note": "よく使う短縮形（縮めた形）"},
    {"long": "are not", "short": "aren't", "note": "よく使う短縮形"},
    {"long": "am not", "short": "短縮形なし", "note": "am notは短縮できない（例外）"}
  ]
}`

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const data = JSON.parse(clean)

    // キャッシュ保存
    await supabase.from('grammar_explanations').upsert({
      grammar_id: unitId,
      grade: grade || 1,
      data,
    }, { onConflict: 'grammar_id' })

    return NextResponse.json({ ...data, cached: false })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
