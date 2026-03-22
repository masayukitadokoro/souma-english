export interface SRSCard {
  ease_factor: number
  interval_days: number
  repetitions: number
}

export type SRSQuality = 0 | 1 | 2 | 3 | 4 | 5

export function sm2(card: SRSCard, quality: SRSQuality): SRSCard {
  let { ease_factor, interval_days, repetitions } = card

  if (quality >= 3) {
    if (repetitions === 0) interval_days = 1
    else if (repetitions === 1) interval_days = 6
    else interval_days = Math.round(interval_days * ease_factor)
    repetitions += 1
  } else {
    repetitions = 0
    interval_days = 1
  }

  ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
  if (ease_factor < 1.3) ease_factor = 1.3

  return { ease_factor, interval_days, repetitions }
}

export function qualityFromCorrect(correct: boolean, usedHint: boolean): SRSQuality {
  if (correct && !usedHint) return 5
  if (correct && usedHint) return 3
  if (!correct) return 1
  return 1
}

export function nextReviewDate(intervalDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + intervalDays)
  return d.toISOString().split('T')[0]
}

export function isMastered(repetitions: number): boolean {
  return repetitions >= 3
}
