'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface Message { role: 'user' | 'assistant'; content: string; choices?: string[] | null; step?: string }

export default function JournalPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const [pastJournals, setPastJournals] = useState<any[]>([])
  const [studyStats, setStudyStats] = useState<any>(null)
  const [journalData, setJournalData] = useState({ motivation: '', challenge: '', today_goal: '' })
  const [completed, setCompleted] = useState(false)
  const [closingMsg, setClosingMsg] = useState<any>(null)
  const [streak, setStreak] = useState(0)
  const [showEndOption, setShowEndOption] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: p } = await supabase.from('student_profiles').select('*').eq('user_id', user.id).single()
      if (!p) { router.push('/onboarding'); return }
      setProfile(p)
      const today = new Date().toISOString().split('T')[0]
      const { data: todayJ } = await supabase.from('daily_journals').select('*').eq('student_id', p.id).eq('date', today).single()
      if (todayJ) {
        setJournalData({ motivation: todayJ.motivation || '', challenge: todayJ.challenge || '', today_goal: todayJ.today_goal || '' })
        setMessages(todayJ.messages || [])
        setCompleted(true)
        return
      }
      const { data: past } = await supabase.from('daily_journals').select('*').eq('student_id', p.id).order('date', { ascending: false }).limit(30)
      setPastJournals(past || [])
      let s = 0
      for (const j of (past || [])) {
        const diff = Math.floor((new Date().getTime() - new Date(j.date).getTime()) / 86400000)
        if (diff === s + 1) s++
        else break
      }
      setStreak(s)
      const { data: wordRecs } = await supabase.from('word_records').select('word,ease_factor,repetitions').eq('student_id', p.id).order('ease_factor', { ascending: true }).limit(5)
      const weakWords = wordRecs?.filter(r => r.ease_factor < 2.2).map(r => r.word) || []
      const { data: lessonRecs } = await supabase.from('lessons').select('grammar_title').eq('student_id', p.id).order('created_at', { ascending: false }).limit(1)
      setStudyStats({ weakWords, lastGrammar: lessonRecs?.[0]?.grammar_title || 'なし' })
      await sendMessage([], p, past || [])
    }
    load()
  }, [router])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // 3回以上やりとりで「終わりにする」オプション表示
  useEffect(() => {
    const userCount = messages.filter(m => m.role === 'user').length
    if (userCount >= 3 && !completed) setShowEndOption(true)
  }, [messages, completed])

  async function sendMessage(currentMessages: Message[], profileData?: any, pastData?: any[]) {
    setLoading(true)
    const p = profileData || profile
    const past = pastData || pastJournals
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: currentMessages, profile: p, pastJournals: past }),
      })
      const data = await res.json()
      const aiMsg: Message = { role: 'assistant', content: data.message, choices: data.choices, step: data.step }
      const newMessages = [...currentMessages, aiMsg]
      setMessages(newMessages)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleClosing() {
    setLoading(true)
    setShowEndOption(false)
    const userMsg: Message = { role: 'user', content: 'そろそろ終わりにする' }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, profile, pastJournals, mode: 'closing', studyStats }),
      })
      const data = await res.json()
      setClosingMsg(data)
      const aiMsg: Message = { role: 'assistant', content: data.message, choices: null, step: 'done' }
      const finalMessages = [...newMessages, aiMsg]
      setMessages(finalMessages)
      await saveJournal(finalMessages)
      setCompleted(true)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  async function handleChoice(choice: string, step: string) {
    const userMsg: Message = { role: 'user', content: choice }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    const newData = { ...journalData }
    if (step === 'motivation') newData.motivation = choice
    if (step === 'challenge') newData.challenge = choice
    if (step === 'goal') newData.today_goal = choice
    setJournalData(newData)
    if (choice === '自分で書く') { inputRef.current?.focus(); return }
    await sendMessage(newMessages)
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    await sendMessage(newMessages)
  }

  async function saveJournal(msgs: Message[]) {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('daily_journals').upsert({
      student_id: profile.id, date: today, messages: msgs,
      motivation: journalData.motivation, challenge: journalData.challenge, today_goal: journalData.today_goal,
    }, { onConflict: 'student_id,date' })
  }

  const lastAiMsg = [...messages].reverse().find(m => m.role === 'assistant')

  if (completed) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fdf4ff, #fae8ff)', padding: '24px 16px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 28, border: '1.5px solid #e9d5ff', textAlign: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔨</div>
          <h2 style={{ fontSize: 18, fontWeight: 500, color: '#581c87', margin: '0 0 4px' }}>準備完了！</h2>
          <p style={{ fontSize: 13, color: '#a78bfa', marginBottom: 20 }}>継続 {streak + 1}日目 🔥</p>
          {closingMsg && (
            <div style={{ background: 'linear-gradient(135deg, #fdf4ff, #ede9fe)', borderRadius: 16, padding: 20, marginBottom: 20, textAlign: 'left', border: '1.5px solid #c4b5fd' }}>
              <p style={{ fontSize: 14, color: '#4c1d95', lineHeight: 1.8, margin: '0 0 16px' }}>{closingMsg.message}</p>
              {closingMsg.action && (
                <button onClick={() => router.push(closingMsg.actionUrl || '/dashboard')}
                  style={{ width: '100%', padding: '14px', borderRadius: 12, border: 'none', background: '#7c3aed', color: 'white', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
                  → {closingMsg.action}を始める 🚀
                </button>
              )}
            </div>
          )}
          {!closingMsg && (
            <button onClick={() => router.push('/dashboard')}
              style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none', background: '#7c3aed', color: 'white', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
              学習を始める 🚀
            </button>
          )}
        </div>
        {pastJournals.length > 0 && (
          <div style={{ background: 'white', borderRadius: 20, padding: 20, border: '1.5px solid #e9d5ff' }}>
            <p style={{ fontSize: 12, fontWeight: 500, color: '#7c3aed', marginBottom: 12 }}>📅 最近の記録</p>
            {pastJournals.slice(0, 5).map((j, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '0.5px solid #f3e8ff', fontSize: 12 }}>
                <span style={{ color: '#6b7280' }}>{j.date}</span>
                <span style={{ color: '#374151', flex: 1, margin: '0 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.today_goal || '記録あり'}</span>
                <span style={{ color: '#a78bfa' }}>✓</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #fdf4ff, #fae8ff)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'white', borderBottom: '1px solid #f3e8ff', padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => router.push('/dashboard')} style={{ color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>← 戻る</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#581c87' }}>🎯 今日の目的確認</div>
          <div style={{ fontSize: 11, color: '#a78bfa' }}>3〜5分でモチベーションを確認しよう</div>
        </div>
        {streak > 0 && <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 500 }}>🔥 {streak}日連続</div>}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px', maxWidth: 560, width: '100%', margin: '0 auto' }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 16, display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
            {msg.role === 'assistant' && <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>🔨</div>}
            <div style={{ maxWidth: '80%', padding: '12px 16px', borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: msg.role === 'user' ? '#7c3aed' : 'white', color: msg.role === 'user' ? 'white' : '#1f2937', fontSize: 14, lineHeight: 1.6, border: msg.role === 'assistant' ? '1.5px solid #e9d5ff' : 'none' }}>
              {msg.content}
            </div>
          </div>
        ))}

        {/* 選択肢 */}
        {!loading && !completed && lastAiMsg?.choices && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16, paddingLeft: 44 }}>
            {lastAiMsg.choices.map((choice, i) => (
              <button key={i} onClick={() => handleChoice(choice, lastAiMsg.step || '')}
                style={{ padding: '10px 16px', borderRadius: 12, border: '1.5px solid #c4b5fd', background: 'white', color: '#5b21b6', fontSize: 13, cursor: 'pointer', textAlign: 'left' }}>
                {choice === '自分で書く' ? '✏️ 自分で書く...' : choice}
              </button>
            ))}
          </div>
        )}

        {/* 「そろそろ終わりにする」ボタン */}
        {showEndOption && !loading && !completed && !lastAiMsg?.choices && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <button onClick={handleClosing}
              style={{ padding: '10px 20px', borderRadius: 20, border: '1.5px solid #c4b5fd', background: 'white', color: '#7c3aed', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>✋</span> そろそろ終わりにする
            </button>
          </div>
        )}

        {loading && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, paddingLeft: 44 }}>
            <div style={{ background: 'white', border: '1.5px solid #e9d5ff', borderRadius: '18px 18px 18px 4px', padding: '14px 18px', display: 'flex', gap: 5 }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: '#c4b5fd', animation: `bounce 1s ${i*0.2}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      {!completed && (
        <div style={{ background: 'white', borderTop: '1px solid #f3e8ff', padding: '12px 16px', maxWidth: 560, width: '100%', margin: '0 auto' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input ref={inputRef} type="text" value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSend()} placeholder="メッセージを入力..." style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e9d5ff', fontSize: 14, outline: 'none', color: '#1f2937' }} />
            <button onClick={handleSend} disabled={!input.trim() || loading} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: input.trim() && !loading ? '#7c3aed' : '#e9d5ff', color: 'white', fontSize: 14, cursor: 'pointer', fontWeight: 500 }}>送信</button>
          </div>
        </div>
      )}
      <style>{`@keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}`}</style>
    </div>
  )
}
