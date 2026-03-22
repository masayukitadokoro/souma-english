'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import grammarSyllabus from '@/data/grammar_syllabus.json'

interface VideoInfo { channel: string; title: string; url: string; duration: string }
interface GrammarUnit { id: string; order: number; title: string; cefr: string; description: string; example: string; videos: VideoInfo[] }
interface ExampleItem { en: string; ja: string; note: string }
interface CardItem { subject: string; subject_ja: string; verb: string; color: string; examples: ExampleItem[] }
interface Transform { base: string; negative: { en: string; ja: string; rule: string }; question: { en: string; ja: string; rule: string } }
interface Contraction { long: string; short: string; note: string }
interface ExplanationData {
  why: string; cards: CardItem[]; transform: Transform; tip: string; contractions: Contraction[]; cached?: boolean
}

const CHANNEL_NAMES: Record<string, string> = {
  naoeigo: 'やり直し英語塾 ナオック', osaru: 'イングリッシュおさる',
  stafuri: 'スタフリ', sekimasao: '関正生', makino: '牧野English',
}
const COLOR_MAP: Record<string, { bg: string; border: string; badge: string; badgeText: string; text: string; subtext: string }> = {
  teal:   { bg: '#E1F5EE', border: '#0F6E56', badge: '#9FE1CB', badgeText: '#085041', text: '#085041', subtext: '#0F6E56' },
  purple: { bg: '#EEEDFE', border: '#534AB7', badge: '#CECBF6', badgeText: '#26215C', text: '#26215C', subtext: '#534AB7' },
  amber:  { bg: '#FAEEDA', border: '#854F0B', badge: '#FAC775', badgeText: '#412402', text: '#412402', subtext: '#633806' },
}
const CEFR_COLOR: Record<string, string> = { A1: 'bg-green-100 text-green-700', A2: 'bg-yellow-100 text-yellow-700', B1: 'bg-purple-100 text-purple-700' }

export default function GrammarMapPage() {
  const router = useRouter()
  const [masteredIds, setMasteredIds] = useState<string[]>([])
  const [reviewIds, setReviewIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGrade, setSelectedGrade] = useState<1|2|3>(1)
  const [openId, setOpenId] = useState<string | null>(null)
  const [explanation, setExplanation] = useState<ExplanationData | null>(null)
  const [loadingExpl, setLoadingExpl] = useState(false)
  const [tab, setTab] = useState<'explain'|'practice'>('explain')
  const [activeCard, setActiveCard] = useState<number | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [checked, setChecked] = useState<Record<number, boolean>>({})
  const [profile, setProfile] = useState<any>(null)

  const gradeUnits: Record<number, GrammarUnit[]> = {
    1: grammarSyllabus.grade1 as GrammarUnit[],
    2: grammarSyllabus.grade2 as GrammarUnit[],
    3: grammarSyllabus.grade3 as GrammarUnit[],
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) return
      setProfile(p)
      setSelectedGrade(p.grade || 1)
      const today = new Date().toISOString().split('T')[0]
      const { data } = await supabase.from('grammar_records').select('grammar_id, mastered, next_review').eq('student_id', p.id)
      setMasteredIds(data?.filter(g => g.mastered).map(g => g.grammar_id) || [])
      setReviewIds(data?.filter(g => !g.mastered && g.next_review <= today).map(g => g.grammar_id) || [])
      setLoading(false)
    }
    load()
  }, [router])

  async function openUnit(unit: GrammarUnit) {
    if (openId === unit.id) { setOpenId(null); setExplanation(null); return }
    setOpenId(unit.id)
    setExplanation(null)
    setTab('explain')
    setActiveCard(null)
    setAnswers({})
    setChecked({})
    setLoadingExpl(true)
    try {
      const res = await fetch('/api/grammar-explanation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ unitId: unit.id, title: unit.title, description: unit.description, grade: profile?.grade || 1, interests: profile?.interests || ['woodworking'], goal: profile?.goal || '宮大工になる' }),
      })
      const data = await res.json()
      setExplanation(data)
    } catch (e) { console.error(e) }
    finally { setLoadingExpl(false) }
  }

  const allUnits = gradeUnits[selectedGrade] || []
  const masteredCount = allUnits.filter(u => masteredIds.includes(u.id)).length
  const totalAll = grammarSyllabus.grade1.length + grammarSyllabus.grade2.length + grammarSyllabus.grade3.length
  const totalMastered = masteredIds.length

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: 48 }} className="animate-bounce">📖</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #EEF2FF 0%, #E0E7FF 100%)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* ヘッダー */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 500, color: '#1e1b4b', margin: 0 }}>📖 文法マップ</h1>
            <p style={{ fontSize: 12, color: '#6366f1', margin: '4px 0 0' }}>タップして解説を見よう</p>
          </div>
          <div style={{ background: 'white', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#4f46e5', fontWeight: 500, border: '1.5px solid #c7d2fe' }}>
            {totalMastered}/{totalAll} 習得
          </div>
        </div>

        {/* 全体進捗バー */}
        <div style={{ background: 'white', borderRadius: 16, padding: '14px 16px', marginBottom: 16, boxShadow: '0 1px 4px rgba(99,102,241,.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            <span>全体の習得進捗</span><span style={{ fontWeight: 500, color: '#4f46e5' }}>{Math.round((totalMastered/totalAll)*100)}%</span>
          </div>
          <div style={{ background: '#e0e7ff', borderRadius: 6, height: 8, overflow: 'hidden' }}>
            <div style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', height: '100%', borderRadius: 6, width: `${(totalMastered/totalAll)*100}%`, transition: 'width .5s' }} />
          </div>
        </div>

        {/* 学年タブ */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
          {([1,2,3] as const).map(g => {
            const mc = gradeUnits[g].filter(u => masteredIds.includes(u.id)).length
            const pct = Math.round((mc/gradeUnits[g].length)*100)
            const active = selectedGrade === g
            return (
              <button key={g} onClick={() => { setSelectedGrade(g); setOpenId(null); setExplanation(null) }}
                style={{ padding: '10px 8px', borderRadius: 14, border: active ? '2px solid #6366f1' : '2px solid #e0e7ff', background: active ? '#6366f1' : 'white', color: active ? 'white' : '#6b7280', cursor: 'pointer', transition: 'all .2s', textAlign: 'center' }}>
                <div style={{ fontWeight: 500, fontSize: 14 }}>中{g}年</div>
                <div style={{ fontSize: 11, marginTop: 3, opacity: .8 }}>{mc}/{gradeUnits[g].length}（{pct}%）</div>
              </button>
            )
          })}
        </div>

        {/* 文法項目リスト */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {allUnits.map(unit => {
            const mastered = masteredIds.includes(unit.id)
            const review = reviewIds.includes(unit.id)
            const isOpen = openId === unit.id
            const borderColor = mastered ? '#10b981' : review ? '#3b82f6' : isOpen ? '#6366f1' : '#e0e7ff'
            const bgColor = mastered ? '#f0fdf4' : review ? '#eff6ff' : 'white'

            return (
              <div key={unit.id} style={{ borderRadius: 16, overflow: 'hidden', border: `2px solid ${borderColor}`, transition: 'all .2s' }}>
                {/* 項目ヘッダー */}
                <button onClick={() => openUnit(unit)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: bgColor, border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{mastered ? '✅' : review ? '🔄' : '📝'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 500, background: unit.cefr === 'A1' ? '#dcfce7' : unit.cefr === 'A2' ? '#fef9c3' : '#ede9fe', color: unit.cefr === 'A1' ? '#166534' : unit.cefr === 'A2' ? '#854d0e' : '#6d28d9' }}>{unit.cefr}</span>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.title}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>{unit.example}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {unit.videos?.length > 0 && <span style={{ fontSize: 10, background: '#fff1f2', color: '#e11d48', padding: '2px 6px', borderRadius: 8 }}>▶ {unit.videos.filter(v => !v.url.includes('placeholder')).length}</span>}
                    <span style={{ color: '#9ca3af', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </button>

                {/* 展開パネル */}
                {isOpen && (
                  <div style={{ background: 'white', borderTop: '1.5px solid #e0e7ff' }}>
                    {loadingExpl ? (
                      <div style={{ padding: 32, textAlign: 'center' }}>
                        <div style={{ fontSize: 36, marginBottom: 12 }} className="animate-bounce">🤖</div>
                        <p style={{ fontSize: 13, color: '#6366f1', fontWeight: 500 }}>AIが解説を作成中...</p>
                        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>初回のみ約5秒。2回目は即座に表示！</p>
                      </div>
                    ) : explanation ? (
                      <div style={{ padding: 16 }}>
                        {/* タブ */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                          {(['explain', 'practice'] as const).map(t => (
                            <button key={t} onClick={() => { setTab(t); setActiveCard(null); setAnswers({}); setChecked({}) }}
                              style={{ padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 500, fontSize: 13, background: tab === t ? '#6366f1' : '#f3f4f6', color: tab === t ? 'white' : '#6b7280', transition: 'all .2s' }}>
                              {t === 'explain' ? '📖 解説' : '🎮 練習問題'}
                            </button>
                          ))}
                        </div>

                        {tab === 'explain' && explanation && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

                            {/* なぜ必要？ */}
                            <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 14, padding: '12px 14px' }}>
                              <p style={{ fontSize: 11, fontWeight: 500, color: '#92400e', marginBottom: 4 }}>🔥 なぜ必要？</p>
                              <p style={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>{explanation.why}</p>
                            </div>

                            {/* インタラクティブカード（スタイルD）*/}
                            <div>
                              <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>💡 主語（文の主役）をタップして使い分けを確認しよう</p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                                {explanation.cards.map((card, i) => {
                                  const c = COLOR_MAP[card.color] || COLOR_MAP.teal
                                  const isActive = activeCard === i
                                  return (
                                    <button key={i} onClick={() => setActiveCard(isActive ? null : i)}
                                      style={{ padding: '12px 8px', borderRadius: 14, border: `2px solid ${isActive ? c.border : c.badge}`, background: isActive ? c.badge : c.bg, cursor: 'pointer', textAlign: 'center', transition: 'all .2s' }}>
                                      <div style={{ fontSize: 13, fontWeight: 500, color: c.text, marginBottom: 2 }}>{card.subject}</div>
                                      <div style={{ fontSize: 10, color: c.subtext, marginBottom: 8 }}>{card.subject_ja}</div>
                                      <div style={{ fontSize: 24, fontWeight: 500, color: c.border, background: 'white', borderRadius: 8, padding: '4px 0' }}>{card.verb}</div>
                                    </button>
                                  )
                                })}
                              </div>

                              {/* 選択中のカード詳細 */}
                              {activeCard !== null && explanation.cards[activeCard] && (() => {
                                const card = explanation.cards[activeCard]
                                const c = COLOR_MAP[card.color] || COLOR_MAP.teal
                                return (
                                  <div style={{ background: c.bg, border: `1.5px solid ${c.badge}`, borderRadius: 14, padding: 14 }}>
                                    <p style={{ fontSize: 12, fontWeight: 500, color: c.text, marginBottom: 10 }}>
                                      {card.subject}（{card.subject_ja}）→ <span style={{ fontSize: 18 }}>{card.verb}</span>
                                    </p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                      {card.examples.map((ex, j) => (
                                        <div key={j} style={{ background: 'white', borderRadius: 10, padding: '10px 12px', border: `1px solid ${c.badge}` }}>
                                          <p style={{ fontSize: 13, fontWeight: 500, color: c.text, marginBottom: 2 }}>{ex.en}</p>
                                          <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{ex.ja}</p>
                                          <p style={{ fontSize: 11, color: c.border }}>→ {ex.note}</p>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )
                              })()}
                            </div>

                            {/* 変換フロー（否定・疑問） */}
                            {explanation.transform && (
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>🔄 文の変換（肯定文（普通の文）→ 否定文・疑問文）</p>
                                <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, padding: 14, marginBottom: 8 }}>
                                  <p style={{ fontSize: 11, color: '#166534', marginBottom: 4 }}>📌 元の肯定文（「〜です」という普通の文）</p>
                                  <p style={{ fontSize: 15, fontWeight: 500, color: '#15803d' }}>{explanation.transform.base}</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                  <div style={{ background: '#fff1f2', border: '1.5px solid #fca5a5', borderRadius: 12, padding: 12 }}>
                                    <p style={{ fontSize: 10, fontWeight: 500, color: '#9f1239', marginBottom: 6 }}>❌ 否定文（「〜ではない」）</p>
                                    <p style={{ fontSize: 12, fontWeight: 500, color: '#be123c', marginBottom: 4 }}>{explanation.transform.negative.en}</p>
                                    <p style={{ fontSize: 10, color: '#9f1239', marginBottom: 6 }}>{explanation.transform.negative.ja}</p>
                                    <p style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5 }}>{explanation.transform.negative.rule}</p>
                                  </div>
                                  <div style={{ background: '#eff6ff', border: '1.5px solid #93c5fd', borderRadius: 12, padding: 12 }}>
                                    <p style={{ fontSize: 10, fontWeight: 500, color: '#1e40af', marginBottom: 6 }}>❓ 疑問文（「〜ですか？」）</p>
                                    <p style={{ fontSize: 12, fontWeight: 500, color: '#1d4ed8', marginBottom: 4 }}>{explanation.transform.question.en}</p>
                                    <p style={{ fontSize: 10, color: '#1e40af', marginBottom: 6 }}>{explanation.transform.question.ja}</p>
                                    <p style={{ fontSize: 10, color: '#6b7280', lineHeight: 1.5 }}>{explanation.transform.question.rule}</p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* 短縮形 */}
                            {explanation.contractions && (
                              <div style={{ background: '#faf5ff', border: '1.5px solid #d8b4fe', borderRadius: 14, padding: 14 }}>
                                <p style={{ fontSize: 11, fontWeight: 500, color: '#6d28d9', marginBottom: 10 }}>✂️ 短縮形（縮めた形）</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {explanation.contractions.map((c, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'white', borderRadius: 8, padding: '8px 12px', border: '1px solid #e9d5ff' }}>
                                      <span style={{ fontSize: 12, color: '#7c3aed', minWidth: 60 }}>{c.long}</span>
                                      <span style={{ color: '#9ca3af', fontSize: 12 }}>→</span>
                                      <span style={{ fontSize: 13, fontWeight: 500, color: '#4c1d95', minWidth: 60 }}>{c.short}</span>
                                      <span style={{ fontSize: 11, color: '#9ca3af' }}>{c.note}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* コツ */}
                            <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 14, padding: '12px 14px' }}>
                              <p style={{ fontSize: 11, fontWeight: 500, color: '#166534', marginBottom: 4 }}>🎯 覚えるコツ</p>
                              <p style={{ fontSize: 13, color: '#15803d', lineHeight: 1.6 }}>{explanation.tip}</p>
                            </div>

                            {/* 動画 */}
                            {unit.videos?.filter(v => !v.url.includes('placeholder')).length > 0 && (
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 500, color: '#6b7280', marginBottom: 8 }}>📺 解説動画</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  {unit.videos.filter(v => !v.url.includes('placeholder')).slice(0, 2).map((v, i) => (
                                    <a key={i} href={v.url} target="_blank" rel="noopener noreferrer"
                                      style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 12, padding: '10px 12px', textDecoration: 'none' }}>
                                      <span style={{ fontSize: 20, flexShrink: 0 }}>▶️</span>
                                      <div style={{ flex: 1, minWidth: 0 }}>
                                        <p style={{ fontSize: 12, fontWeight: 500, color: '#1f2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{v.title}</p>
                                        <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>{CHANNEL_NAMES[v.channel] || v.channel} · {v.duration}</p>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* キャッシュ表示 */}
                            {explanation.cached && (
                              <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>⚡ 保存済みデータを読み込みました（高速表示）</p>
                            )}

                            <button onClick={() => { setTab('practice'); setAnswers({}); setChecked({}) }}
                              style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                              🎮 練習問題に挑戦する →
                            </button>
                          </div>
                        )}

                        {tab === 'practice' && explanation && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                            {/* 穴埋め問題（カードから自動生成・ランダムシャッフル） */}
                            {explanation.cards.map((card, cardIdx) => {
                              const options = explanation.cards.map(c => c.verb)
                              const correctIdx = options.indexOf(card.verb)
                              const qIdx = cardIdx
                              const isChecked = checked[qIdx]
                              const userAnswer = answers[qIdx]
                              const isCorrect = userAnswer === correctIdx

                              return (
                                <div key={cardIdx} style={{ borderRadius: 14, border: `2px solid ${isChecked ? (isCorrect ? '#10b981' : '#f87171') : '#e0e7ff'}`, background: isChecked ? (isCorrect ? '#f0fdf4' : '#fff1f2') : 'white', padding: 14, transition: 'all .2s' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, background: '#e0e7ff', color: '#4f46e5', fontWeight: 500 }}>穴埋め</span>
                                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Q{qIdx + 1}</span>
                                  </div>
                                  <p style={{ fontSize: 13, color: '#374151', marginBottom: 10, lineHeight: 1.6 }}>
                                    主語（文の主役）が「{card.subject}（{card.subject_ja}）」のとき、be動詞（am/is/are）はどれ？
                                  </p>
                                  <p style={{ fontSize: 15, fontWeight: 500, color: '#6366f1', background: '#f0f0ff', borderRadius: 10, padding: '8px 12px', marginBottom: 12 }}>
                                    {card.examples[0].en.replace(card.verb, '___')}
                                  </p>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                                    {options.map((opt, oi) => {
                                      let bg = '#f9fafb', border = '#e5e7eb', color = '#374151'
                                      if (isChecked) {
                                        if (oi === correctIdx) { bg = '#dcfce7'; border = '#16a34a'; color = '#15803d' }
                                        else if (oi === userAnswer) { bg = '#fee2e2'; border = '#dc2626'; color = '#b91c1c' }
                                        else { bg = '#f9fafb'; color = '#9ca3af' }
                                      } else if (userAnswer === oi) {
                                        bg = '#e0e7ff'; border = '#6366f1'; color = '#4338ca'
                                      }
                                      return (
                                        <button key={oi} disabled={isChecked} onClick={() => setAnswers(prev => ({ ...prev, [qIdx]: oi }))}
                                          style={{ padding: '10px 0', borderRadius: 10, border: `2px solid ${border}`, background: bg, color, fontSize: 16, fontWeight: 500, cursor: isChecked ? 'default' : 'pointer', transition: 'all .15s' }}>
                                          {opt}
                                        </button>
                                      )
                                    })}
                                  </div>
                                  {!isChecked ? (
                                    <button disabled={userAnswer === undefined} onClick={() => setChecked(prev => ({ ...prev, [qIdx]: true }))}
                                      style={{ padding: '10px 20px', borderRadius: 10, border: 'none', background: userAnswer === undefined ? '#e5e7eb' : '#6366f1', color: userAnswer === undefined ? '#9ca3af' : 'white', fontSize: 13, fontWeight: 500, cursor: userAnswer === undefined ? 'default' : 'pointer' }}>
                                      確認する
                                    </button>
                                  ) : (
                                    <div style={{ padding: '10px 14px', borderRadius: 10, background: isCorrect ? '#dcfce7' : '#fee2e2', fontSize: 13, color: isCorrect ? '#15803d' : '#b91c1c' }}>
                                      <p style={{ fontWeight: 500, margin: '0 0 4px' }}>{isCorrect ? '🎉 正解！' : `😊 不正解。正解は「${card.verb}」`}</p>
                                      <p style={{ fontSize: 12, margin: 0 }}>{card.examples[0].note}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })}

                            <button onClick={() => router.push(`/lesson?type=grammar&topic=${encodeURIComponent(unit.title)}`)}
                              style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: '#6366f1', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                              📝 もっと練習する →
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: '#ef4444' }}>読み込みに失敗しました</div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
