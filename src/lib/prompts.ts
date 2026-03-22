import syllabusData from '@/data/syllabus.json'

export const DIAGNOSTIC_SYSTEM = `
あなたは中学1年生向けの英語診断テストを作成するAIです。
すべての説明は日本語で書く。
問題は中学1年生レベル（アルファベット〜be動詞・一般動詞の基礎）。
問題は必ずJSON形式で返す。
単語・文法・読解の3カテゴリを各4問、合計12問。
`

export const DIAGNOSTIC_PROMPT = (goal: string, interests: string[]) => `
生徒の目標：${goal}
生徒の興味：${interests.join('、')}

この生徒に合った英語診断テストを以下のJSON形式で12問作成してください：
{
  "questions": [
    {
      "id": 1,
      "category": "vocabulary",
      "question": "問題文（日本語）",
      "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correct": 0,
      "explanation": "解説（日本語）"
    }
  ]
}
`

export const LEARNING_PLAN_SYSTEM = `
あなたは中学1年生の英語学習プランを作成するAIです。
診断結果を元に、生徒の興味・目標に合わせたパーソナライズされた学習プランをJSON形式で返してください。
`

export const LEARNING_PLAN_PROMPT = (
  goal: string,
  interests: string[],
  scores: { vocab: number; grammar: number; reading: number },
  weakPoints: string[]
) => `
生徒情報：
- 目標：${goal}
- 興味：${interests.join('、')}
- 診断スコア：単語 ${scores.vocab}/4、文法 ${scores.grammar}/4、読解 ${scores.reading}/4
- 弱点：${weakPoints.join('、')}

以下のJSON形式で今後4週間の学習プランを作成してください：
{
  "summary": "診断コメント（励ます言葉で）",
  "weak_points": ["弱点1", "弱点2"],
  "next_steps": ["次にやること1", "次にやること2", "次にやること3"],
  "weekly_plan": [
    {
      "week": 1,
      "focus": "フォーカステーマ",
      "lessons": [
        { "type": "vocabulary", "topic": "レッスントピック", "reason": "なぜこれをやるか（日本語）" }
      ]
    }
  ]
}
`

export const LESSON_SYSTEM = `
あなたは中学生向けの英語レッスンを作成するAIです。
以下のルールを守ってください：
- すべての説明は日本語
- 例文は生徒の興味（ものづくり・大工・ゲームなど）に関連させる
- ゲーム感覚で楽しく学べる構成
- 1レッスン5〜7問のクイズ形式
- 必ずJSON形式のみで返す（前置き・後置きは不要）
`

export const LESSON_PROMPT = (
  type: string,
  topic: string,
  interests: string[],
  goal: string,
  skillLevel: number = 1,
  grade: number = 1
) => {
  const syllabus = syllabusData.syllabus as any
  let syllabusContext = ''

  if (type === 'vocabulary' && syllabus.vocabulary) {
    const levelData = syllabus.vocabulary.levels.find((l: any) => l.level === skillLevel)
    if (levelData) {
      syllabusContext = `
参考シラバス（語彙レベル${skillLevel}）:
- テーマ：${levelData.theme}
- 目標単語数：${levelData.target_words}語
- カテゴリ例：${levelData.categories.map((c: any) => c.name).join('、')}
- 評価方法：${levelData.assessment}
`
    }
  } else if (type === 'grammar' && syllabus.grammar) {
    const levelData = syllabus.grammar.levels.find((l: any) => l.level === skillLevel)
    if (levelData) {
      const units = levelData.units || []
      syllabusContext = `
参考シラバス（文法レベル${skillLevel}）:
- 学習単元：${units.map((u: any) => u.title).join('、')}
- 例文：${units[0]?.example || ''}
`
    }
  } else if (type === 'communication' && syllabus.communication) {
    const levelData = syllabus.communication.levels.find((l: any) => l.level === skillLevel)
    if (levelData) {
      syllabusContext = `
参考シラバス（コミュニケーションレベル${skillLevel}）:
- シーン：${levelData.scenarios?.map((s: any) => s.scene).join('、')}
`
    }
  }

  return `
レッスン情報：
- タイプ：${type}（vocabulary=語彙 / grammar=文法 / conversation=会話）
- トピック：${topic}
- 生徒の興味：${interests.join('、')}
- 生徒の目標：${goal}
- 学年：中学${grade}年生
- スキルレベル：${skillLevel}/5

${syllabusContext}

上記のシラバスに基づいて、以下のJSON形式でレッスンを作成してください：
{
  "title": "レッスンタイトル",
  "skill": "${type}",
  "level": ${skillLevel},
  "intro": "導入（日本語・生徒の興味に絡めた説明・2-3文）",
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "question": "問題文（日本語で説明）",
      "english": "英語の問題文（あれば）",
      "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
      "correct": 0,
      "hint": "ヒント（日本語）",
      "explanation": "解説（日本語・なぜこの答えなのかを丁寧に）"
    }
  ],
  "summary": "レッスンで学んだことのまとめ（3点）",
  "completion_message": "完了メッセージ（生徒の目標と絡めて励ます言葉）",
  "next_skill": "次に学ぶべきスキルの提案"
}
`
}

export const MOTIVATION_PROMPT = (goal: string, interests: string[]) => `
中学1年生のソウマくんへのメッセージを書いてください。
目標：${goal}
興味：${interests.join('、')}

「なぜ英語を勉強するとこの目標に近づけるか」を以下のJSON形式で、ワクワクする言葉で説明してください：
{
  "title": "タイトル",
  "sections": [
    { "heading": "見出し", "body": "本文（日本語・わかりやすく）", "example_english": "関連する簡単な英語フレーズ" }
  ],
  "closing": "締めのメッセージ"
}
`
