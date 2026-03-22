import { NextRequest, NextResponse } from 'next/server'
import wordsData from '@/data/words.json'

interface Word {
  id: number
  word: string
  translation: string
  grade: number
  category: string
  cefr: string
  theme?: string
}

export async function POST(req: NextRequest) {
  const { grade = 1, interests = [], reviewWordIds = [], seenWordIds = [], count = 10 } = await req.json()

  const allWords = (wordsData.words as Word[]).filter(w => w.grade <= grade)

  const reviewWords = allWords
    .filter(w => reviewWordIds.includes(w.id))
    .slice(0, Math.min(4, count))

  const usedIds = new Set([...reviewWordIds, ...seenWordIds])

  const themeWords = allWords.filter(w =>
    !usedIds.has(w.id) &&
    w.theme === 'making' &&
    interests.some((i: string) => i === 'woodworking' || i === 'making')
  ).sort(() => Math.random() - 0.5)

  const otherWords = allWords
    .filter(w => !usedIds.has(w.id) && !themeWords.includes(w))
    .sort(() => Math.random() - 0.5)

  const needed = count - reviewWords.length
  const themeCount = Math.min(Math.ceil(needed * 0.25), themeWords.length)
  const otherCount = needed - themeCount

  const targetWords = [
    ...reviewWords,
    ...themeWords.slice(0, themeCount),
    ...otherWords.slice(0, otherCount),
  ].slice(0, count)

  const wordsWithOptions = targetWords.map(w => {
    const distractors = allWords
      .filter(x => x.id !== w.id && x.category === w.category)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3)
      .map(x => x.translation)

    const allOptions = [...distractors, w.translation].sort(() => Math.random() - 0.5)
    const correctIndex = allOptions.indexOf(w.translation)

    return {
      ...w,
      options_ja: allOptions,
      correct_ja: correctIndex,
    }
  })

  return NextResponse.json({
    words: wordsWithOptions,
    review_count: reviewWords.length,
    new_count: targetWords.length - reviewWords.length,
  })
}
