export type UserRole = 'student' | 'parent'

export interface StudentProfile {
  id: string
  user_id: string
  name: string
  goal: string
  interests: string[]
  streak_count: number
  last_study_at: string | null
  created_at: string
}

export interface DiagnosticResult {
  id: string
  student_id: string
  vocab_score: number
  grammar_score: number
  reading_score: number
  weak_points: string[]
  learning_plan: LearningPlan
  taken_at: string
}

export interface LearningPlan {
  summary: string
  weak_points: string[]
  next_steps: string[]
  weekly_plan: WeeklyPlan[]
}

export interface WeeklyPlan {
  week: number
  focus: string
  lessons: LessonItem[]
}

export interface LessonItem {
  type: 'vocabulary' | 'grammar' | 'conversation'
  topic: string
  reason: string
}

export interface QuizQuestion {
  id: number
  category?: string
  type?: string
  question: string
  options: string[]
  correct: number
  hint?: string
  explanation: string
}

export interface Badge {
  id: string
  student_id: string
  badge_key: string
  title: string
  earned_at: string
}
