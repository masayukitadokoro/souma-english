'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Volume2, Play, CheckCircle, XCircle, ArrowLeft, X, Keyboard, PenLine, FileText, Layers, Headphones, Shuffle, Sparkles, BookOpen, Dumbbell } from 'lucide-react'

type DrillItem = {
  question_text: string; question_text_jp?: string; correct_answer?: string;
  explanation_jp?: string; user_answer: string; question_type: string; category: string;
  isGenerated?: boolean; level?: number;
}
type DrillMode = 'menu' | 'spelling' | 'grammar' | 'write3' | 'flashcard' | 'dictation' | 'reorder'

const MODES: { key: DrillMode; icon: React.ReactNode; label: string; desc: string }[] = [
  { key: 'spelling', icon: <Keyboard size={20} />, label: 'スペル練習', desc: '単語を4回タイピング' },
  { key: 'grammar', icon: <Shuffle size={20} />, label: '語順トレーニング', desc: '単語を正しい順に並べる' },
  { key: 'write3', icon: <FileText size={20} />, label: '段階書き取り', desc: '見ながら→隠して書く' },
  { key: 'flashcard', icon: <Layers size={20} />, label: 'フラッシュカード', desc: '表裏で暗記練習' },
  { key: 'dictation', icon: <Headphones size={20} />, label: 'ディクテーション', desc: '音声だけで書き取る' },
  { key: 'reorder', icon: <Shuffle size={20} />, label: '語順並び替え', desc: '日本語から英文を組み立てる' },
]

function shuffle<T>(a: T[]): T[] { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }; return b }

function getComplete(item: DrillItem | undefined): string {
  if (!item) return ''
  if ((item.question_type === 'fill_blank' || item.question_type === 'multiple_choice') && item.correct_answer) return item.question_text.replace(/___+/g, item.correct_answer)
  return item.correct_answer || item.question_text
}

/** question_text_jpはテスト時の指示文（「（　）に入る正しい語を選びなさい。」等）であり、
 *  ドリル時の日本語の「意味」ではない。問題タイプに応じて適切な表示テキストを返す。 */
function getDrillTexts(item: DrillItem) {
  const type = item.question_type
  const complete = getComplete(item)

  if (type === 'vocab_jp_en') {
    // question_text = 日本語の単語, correct_answer = 英語の単語
    return {
      jpDisplay: item.question_text,
      enDisplay: item.correct_answer || '',
      target: item.correct_answer || '',
      meaningHint: item.question_text,
    }
  }
  if (type === 'vocab_en_jp') {
    // question_text = 英語の単語, correct_answer = 日本語の単語
    return {
      jpDisplay: item.correct_answer || '',
      enDisplay: item.question_text,
      target: item.question_text,
      meaningHint: item.correct_answer || '',
    }
  }
  if (type === 'fill_blank' || type === 'multiple_choice') {
    // question_text = "She ___ a student.", question_text_jp = テスト指示文（使わない）
    return {
      jpDisplay: item.explanation_jp?.replace(/^💡\s*/, '').split('。')[0] || '',
      enDisplay: complete,
      target: complete,
      meaningHint: item.explanation_jp || '',
    }
  }
  if (type === 'writing') {
    return {
      jpDisplay: item.question_text_jp || '',
      enDisplay: item.correct_answer || '',
      target: item.correct_answer || '',
      meaningHint: item.question_text_jp || '',
    }
  }
  return { jpDisplay: '', enDisplay: complete, target: complete, meaningHint: item.explanation_jp || '' }
}

function speak(text: string, rate = 0.85) { const u = new SpeechSynthesisUtterance(text.replace(/___+/g, '').replace(/[()（）]/g, '')); u.lang = 'en-US'; u.rate = rate; speechSynthesis.cancel(); speechSynthesis.speak(u) }

function SpeakerBtn({ text, size = 'sm' }: { text: string; size?: 'sm' | 'md' }) {
  return <button onClick={() => speak(text)} className="flex-shrink-0 p-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 active:scale-95 transition-all"><Volume2 size={size === 'sm' ? 16 : 22} className="text-indigo-500" /></button>
}

function QProgress({ current, total, results }: { current: number; total: number; results: ('correct' | 'wrong' | null)[] }) {
  return <div className="flex items-center gap-2 mb-3">{Array.from({ length: total }, (_, i) => <div key={i} className={`flex-1 h-2 rounded-full ${results[i] === 'correct' ? 'bg-emerald-400' : results[i] === 'wrong' ? 'bg-red-400' : i === current ? 'bg-indigo-400' : 'bg-gray-200'}`} />)}<span className="text-xs text-gray-500 whitespace-nowrap">{current + 1}/{total}</span></div>
}

function QTag({ item, idx }: { item: DrillItem; idx: number }) {
  return <div className="flex items-center gap-1.5 mb-2">{item.isGenerated ? <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-700 flex items-center gap-1"><Sparkles size={10} />類似問題</span> : <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-indigo-100 text-indigo-700 flex items-center gap-1"><BookOpen size={10} />元の問題</span>}<span className="text-[10px] text-gray-500">{idx + 1}問目</span></div>
}

function ResultBox({ result, children }: { result: 'correct' | 'wrong'; children: React.ReactNode }) {
  return <div className={`p-4 rounded-xl flex items-start gap-3 ${result === 'correct' ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-red-50 border-2 border-red-200'}`}>{result === 'correct' ? <CheckCircle size={22} className="text-emerald-500 flex-shrink-0 mt-0.5" /> : <XCircle size={22} className="text-red-500 flex-shrink-0 mt-0.5" />}<div className="flex-1">{children}</div></div>
}

// ─── SPELLING (4問: 元の単語1-2回 + 同レベルランダム2-3回) ───
function SpellingDrill({ items, onDone }: { items: DrillItem[]; onDone: (r: ('correct' | 'wrong')[]) => void }) {
  const [all, setAll] = useState<DrillItem[]>([]); const [loading, setLoading] = useState(true)
  const [idx, setIdx] = useState(0); const [input, setInput] = useState(''); const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [results, setResults] = useState<('correct' | 'wrong' | null)[]>([])

  useEffect(() => {
    (async () => {
      const orig = items[0]; if (!orig) { setAll(items); setLoading(false); return }
      const { data } = await supabase.from('questions').select('*').eq('level', orig.level || 1).in('question_type', ['vocab_jp_en', 'vocab_en_jp']).neq('correct_answer', orig.correct_answer || '').limit(20)
      const extras = shuffle(data || []).slice(0, 3).map((q: any) => ({ question_text: q.question_text, question_text_jp: q.question_text_jp, correct_answer: q.correct_answer, explanation_jp: q.explanation_jp, user_answer: '', question_type: q.question_type, category: q.category, isGenerated: true, level: orig.level }))
      // 元の単語1回 + ランダム3回 = 4問
      const combined = shuffle([{ ...orig, isGenerated: false }, ...extras]).slice(0, 4)
      setAll(combined); setResults(combined.map(() => null)); setLoading(false)
    })()
  }, [])

  if (loading) return <p className="text-sm text-gray-400 text-center py-6 animate-pulse">単語を準備中...</p>
  if (!all.length) return <p className="text-sm text-gray-500 p-4">スペル練習できる問題がありません</p>
  const item = all[idx]; const texts = getDrillTexts(item)
  // スペル練習: 日本語を見て英語のスペルを書く
  const displayText = texts.jpDisplay || texts.meaningHint || item.question_text
  const answer = texts.target

  const check = () => { const r: 'correct' | 'wrong' = input.trim().toLowerCase() === answer.toLowerCase() ? 'correct' : 'wrong'; setResult(r); const nr = [...results]; nr[idx] = r; setResults(nr) }
  const next = () => { if (idx + 1 >= all.length) { onDone(results.map(r => r || 'wrong')); return }; setIdx(idx + 1); setInput(''); setResult(null) }

  return (
    <div className="space-y-3">
      <QProgress current={idx} total={all.length} results={results} />
      <QTag item={item} idx={idx} />
      <div className="bg-white rounded-xl p-5 text-center border border-gray-200">
        <p className="text-xs text-gray-500 mb-2">この単語を英語で正しく書きなさい</p>
        <p className="text-2xl font-bold text-gray-800">{displayText}</p>
      </div>
      {result === null ? (
        <div>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && input.trim() && check()} placeholder="英語のスペルを入力..." autoFocus autoComplete="off" className="w-full p-3 border-2 border-gray-200 rounded-xl text-lg focus:border-indigo-500 focus:outline-none" />
          <button onClick={check} disabled={!input.trim()} className="w-full mt-2 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl font-bold disabled:opacity-40">チェック</button>
        </div>
      ) : (
        <div>
          <ResultBox result={result}>
            <p className={`font-bold ${result === 'correct' ? 'text-emerald-600' : 'text-red-500'}`}>{result === 'correct' ? '正解！' : '不正解'}</p>
            {result === 'wrong' && <p className="text-sm text-gray-600 mt-1">あなた: <span className="text-red-500">{input}</span> → 正答: <span className="text-indigo-600 font-bold">{answer}</span></p>}
            <div className="mt-1"><SpeakerBtn text={answer} /></div>
          </ResultBox>
          <button onClick={next} className="w-full mt-2 py-3 bg-indigo-500 text-white rounded-xl font-bold">{idx + 1 >= all.length ? '結果を見る' : '次の単語 →'}</button>
        </div>
      )}
    </div>
  )
}

// ─── SHARED: 語順並べ替えUI（ドラッグ&ドロップ + タップ対応） ───
function WordReorderUI({ pool, sel, onAdd, onRemove, disabled }: {
  pool: string[]; sel: string[]; onAdd: (w: string, pi: number) => void; onRemove: (si: number) => void; disabled?: boolean
}) {
  const [dragIdx, setDragIdx] = useState<{ from: 'pool' | 'sel'; idx: number } | null>(null)
  const [dropHover, setDropHover] = useState(false)

  const handleDragStart = (from: 'pool' | 'sel', idx: number) => (e: React.DragEvent) => {
    setDragIdx({ from, idx })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', '')
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropHover(true) }
  const handleDragLeave = () => setDropHover(false)
  const handleDropOnSel = (e: React.DragEvent) => {
    e.preventDefault(); setDropHover(false)
    if (dragIdx?.from === 'pool') onAdd(pool[dragIdx.idx], dragIdx.idx)
    setDragIdx(null)
  }
  const handleDropOnPool = (e: React.DragEvent) => {
    e.preventDefault()
    if (dragIdx?.from === 'sel') onRemove(dragIdx.idx)
    setDragIdx(null)
  }
  const handleDragEnd = () => { setDragIdx(null); setDropHover(false) }

  return (
    <>
      {/* ドロップゾーン（選択済み単語） */}
      <div
        className={`min-h-[56px] p-3 rounded-xl flex flex-wrap gap-2 transition-colors ${
          dropHover ? 'bg-indigo-100 border-2 border-indigo-400' : 'bg-indigo-50 border-2 border-dashed border-indigo-200'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropOnSel}
      >
        {sel.length === 0 && <p className="text-sm text-indigo-300">タップまたはドラッグで単語を並べよう</p>}
        {sel.map((w, i) => (
          <button
            key={`${w}-${i}`}
            draggable={!disabled}
            onDragStart={handleDragStart('sel', i)}
            onDragEnd={handleDragEnd}
            onClick={() => !disabled && onRemove(i)}
            className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 cursor-grab active:cursor-grabbing select-none"
          >{w}</button>
        ))}
      </div>

      {/* プール（未選択単語） */}
      {!disabled && (
        <div
          className="flex flex-wrap gap-2"
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
          onDrop={handleDropOnPool}
        >
          {pool.map((w, i) => (
            <button
              key={`${w}-${i}`}
              draggable
              onDragStart={handleDragStart('pool', i)}
              onDragEnd={handleDragEnd}
              onClick={() => onAdd(w, i)}
              className="px-3 py-1.5 bg-white border-2 border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:border-indigo-300 hover:bg-indigo-50 cursor-grab active:cursor-grabbing select-none"
            >{w}</button>
          ))}
        </div>
      )}
    </>
  )
}

// ─── GRAMMAR → 語順トレーニング（並べ替え方式に変更） ───
function GrammarDrill({ items, onDone }: { items: DrillItem[]; onDone: (r: ('correct' | 'wrong')[]) => void }) {
  const [idx, setIdx] = useState(0); const [sel, setSel] = useState<string[]>([]); const [pool, setPool] = useState<string[]>([])
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [results, setResults] = useState<('correct' | 'wrong' | null)[]>(items.map(() => null))

  useEffect(() => { resetQ(0) }, [])

  const resetQ = (i: number) => {
    const item = items[i]; if (!item) return
    const texts = getDrillTexts(item)
    const target = texts.target.replace(/[.!?]/g, '')
    setPool(shuffle(target.split(' ').filter(Boolean))); setSel([]); setResult(null)
  }

  const item = items[idx]; if (!item) return null
  const texts = getDrillTexts(item)
  const target = texts.target.replace(/[.!?]/g, '').trim()

  const add = (w: string, pi: number) => { setSel([...sel, w]); const np = [...pool]; np.splice(pi, 1); setPool(np) }
  const rm = (si: number) => { if (result) return; setPool([...pool, sel[si]]); const ns = [...sel]; ns.splice(si, 1); setSel(ns) }
  const check = () => { const r: 'correct' | 'wrong' = sel.join(' ').toLowerCase() === target.toLowerCase() ? 'correct' : 'wrong'; setResult(r); const nr = [...results]; nr[idx] = r; setResults(nr) }
  const next = () => { if (idx + 1 >= items.length) { onDone(results.map(r => r || 'wrong')); return }; const ni = idx + 1; setIdx(ni); resetQ(ni) }

  return (
    <div className="space-y-3">
      <QProgress current={idx} total={items.length} results={results} />
      <QTag item={item} idx={idx} />
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">下の単語を正しい順番に並べて英文を作ろう</p>
        {texts.jpDisplay ? <p className="text-base font-bold text-gray-800">{texts.jpDisplay}</p> : <p className="text-sm text-gray-500">（{pool.length + sel.length}語の英文を作ろう）</p>}
      </div>
      <WordReorderUI pool={pool} sel={sel} onAdd={add} onRemove={rm} disabled={result !== null} />
      {result === null ? <button onClick={check} disabled={pool.length > 0} className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-40">チェック</button> : (
        <div>
          <ResultBox result={result}>
            <p className={`font-bold ${result === 'correct' ? 'text-emerald-600' : 'text-red-500'}`}>{result === 'correct' ? '正解！' : '不正解'}</p>
            <div className="flex items-center gap-2 mt-1"><p className="text-sm font-medium text-indigo-700">{texts.target}</p><SpeakerBtn text={texts.target} /></div>
            {item.explanation_jp && <p className="text-xs text-gray-500 mt-1">{item.explanation_jp}</p>}
          </ResultBox>
          <button onClick={next} className="w-full mt-2 py-3 bg-indigo-500 text-white rounded-xl font-bold">{idx + 1 >= items.length ? '結果を見る' : '次へ →'}</button>
        </div>
      )}
    </div>
  )
}

// ─── WRITE3 (1回目見ながら、2-3回目隠して。不正解も表示) ───
function Write3Drill({ items, onDone }: { items: DrillItem[]; onDone: (r: ('correct' | 'wrong')[]) => void }) {
  const [idx, setIdx] = useState(0); const [inputs, setInputs] = useState(['', '', '']); const [done, setDone] = useState([false, false, false])
  const [lineResults, setLineResults] = useState<('correct' | 'wrong' | null)[]>([null, null, null])
  const [results, setResults] = useState<('correct' | 'wrong' | null)[]>(items.map(() => null))
  const item = items[idx]; if (!item) return null
  const texts = getDrillTexts(item)
  const target = texts.target

  const checkLine = (i: number) => {
    const isCorrect = inputs[i].trim().toLowerCase() === target.toLowerCase()
    const nd = [...done]; nd[i] = true; setDone(nd)
    const lr = [...lineResults]; lr[i] = isCorrect ? 'correct' : 'wrong'; setLineResults(lr)
  }
  const allDone = done.every(Boolean)
  const correctCount = lineResults.filter(r => r === 'correct').length
  const next = () => {
    const nr = [...results]; nr[idx] = correctCount >= 2 ? 'correct' : 'wrong'; setResults(nr)
    if (idx + 1 >= items.length) { onDone(nr.map(r => r || 'wrong')); return }
    setIdx(idx + 1); setInputs(['', '', '']); setDone([false, false, false]); setLineResults([null, null, null])
  }

  return (
    <div className="space-y-3">
      <QProgress current={idx} total={items.length} results={results} />
      <QTag item={item} idx={idx} />
      {/* 日本語の意味を表示（テスト指示文ではなく） */}
      {texts.jpDisplay && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">上の日本語を英語にして下に書きましょう</p>
          <p className="text-base font-bold text-gray-800">{texts.jpDisplay}</p>
        </div>
      )}
      {!texts.jpDisplay && texts.meaningHint && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-xs text-gray-500 mb-1">下の英文を練習しましょう</p>
          <p className="text-sm text-gray-600">{texts.meaningHint}</p>
        </div>
      )}
      <div className="space-y-3">
        {[0, 1, 2].map(i => {
          const showEn = i === 0
          // 1回目完了後は折りたたんで英文を隠す（2-3回目で答えが見えないように）
          if (showEn && done[i]) return (
            <div key={i} className={`p-3 rounded-xl border-2 flex items-center gap-2 ${lineResults[i] === 'correct' ? 'border-emerald-300 bg-emerald-50' : 'border-amber-300 bg-amber-50'}`}>
              {lineResults[i] === 'correct' ? <CheckCircle size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-amber-500" />}
              <span className={`text-sm font-medium ${lineResults[i] === 'correct' ? 'text-emerald-600' : 'text-amber-600'}`}>
                1回目 {lineResults[i] === 'correct' ? '正解' : '不正解'}
              </span>
            </div>
          )
          return (
            <div key={i} className={`p-3 rounded-xl border-2 ${done[i] ? (lineResults[i] === 'correct' ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50') : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {done[i] ? (lineResults[i] === 'correct' ? <CheckCircle size={16} className="text-emerald-500" /> : <XCircle size={16} className="text-red-500" />) : <span className="text-sm font-bold text-gray-400">{i + 1}回目</span>}
                  {showEn ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">英文を見ながら書こう</span>
                    : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">英文を見ないで書こう</span>}
                </div>
                {!done[i] && !showEn && <button onClick={() => speak(target)} className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"><Volume2 size={14} />英文を聞く</button>}
              </div>
              {showEn && !done[i] && <p className="text-lg font-bold text-indigo-700 mb-2">{target}</p>}
              {showEn && !done[i] && <SpeakerBtn text={target} />}
              {done[i] ? (
                <div className="space-y-1">
                  {lineResults[i] === 'wrong' && (
                    <>
                      <p className="text-sm text-red-500">あなた: {inputs[i]}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-indigo-700">正答: {target}</p>
                        <SpeakerBtn text={target} />
                      </div>
                    </>
                  )}
                  {lineResults[i] === 'correct' && <span className="text-sm text-emerald-600 font-medium">正解！</span>}
                </div>
              ) : (
                <div className="flex items-center gap-2 mt-1">
                  <input value={inputs[i]} onChange={e => { const n = [...inputs]; n[i] = e.target.value; setInputs(n) }} onKeyDown={e => e.key === 'Enter' && inputs[i].trim() && checkLine(i)}
                    placeholder={showEn ? '上の英文をそのまま書こう' : '思い出して英語を書こう'} autoComplete="off"
                    className="flex-1 p-2.5 border-2 rounded-xl text-sm focus:outline-none border-gray-200 focus:border-indigo-500" />
                  <button onClick={() => checkLine(i)} disabled={!inputs[i].trim()} className="px-3 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold disabled:opacity-40">確認</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {allDone && (
        <div>
          <div className={`border-2 rounded-xl p-4 text-center flex items-center justify-center gap-2 ${
            correctCount === 3 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'
          }`}>
            {correctCount === 3 ? <CheckCircle size={20} className="text-emerald-500" /> : <XCircle size={20} className="text-amber-500" />}
            <p className={`font-bold ${correctCount === 3 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {correctCount}/3回 正解！
            </p>
          </div>
          <button onClick={next} className="w-full mt-2 py-3 bg-indigo-500 text-white rounded-xl font-bold">{idx + 1 >= items.length ? '結果を見る' : '次の問題 →'}</button>
        </div>
      )}
    </div>
  )
}

// ─── FLASHCARD ───
function FlashcardDrill({ items, onDone }: { items: DrillItem[]; onDone: (r: ('correct' | 'wrong')[]) => void }) {
  const [idx, setIdx] = useState(0); const [flipped, setFlipped] = useState(false)
  const [results, setResults] = useState<('correct' | 'wrong' | null)[]>(items.map(() => null))
  const item = items[idx]; if (!item) return null
  const texts = getDrillTexts(item)
  // 表面: 日本語（意味）、裏面: 英語
  const front = texts.jpDisplay || texts.meaningHint || item.question_text
  const back = texts.enDisplay || texts.target

  const handle = (ok: boolean) => { const nr = [...results]; nr[idx] = ok ? 'correct' : 'wrong'; setResults(nr); if (idx + 1 >= items.length) { onDone(nr.map(r => r || 'wrong')); return }; setIdx(idx + 1); setFlipped(false) }
  return (
    <div className="space-y-3">
      <QProgress current={idx} total={items.length} results={results} />
      <QTag item={item} idx={idx} />
      <button onClick={() => { setFlipped(!flipped); if (!flipped) speak(back) }} className="w-full bg-white rounded-2xl border-2 border-gray-200 hover:border-indigo-300 p-8 text-center min-h-[160px] flex flex-col items-center justify-center transition-all">
        {!flipped ? <><p className="text-xs text-gray-400 mb-2">タップして答えを確認</p><p className="text-2xl font-bold text-gray-800">{front}</p></> : <><p className="text-xs text-gray-400 mb-2">答え</p><p className="text-2xl font-bold text-indigo-700">{back}</p><div className="mt-3"><SpeakerBtn text={back} size="md" /></div></>}
      </button>
      {flipped && <div className="flex gap-2">
        <button onClick={() => handle(false)} className="flex-1 py-3 bg-red-50 border-2 border-red-200 text-red-600 rounded-xl font-bold hover:bg-red-100 flex items-center justify-center gap-1"><XCircle size={16} />まだ</button>
        <button onClick={() => handle(true)} className="flex-1 py-3 bg-emerald-50 border-2 border-emerald-200 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 flex items-center justify-center gap-1"><CheckCircle size={16} />覚えた</button>
      </div>}
    </div>
  )
}

// ─── DICTATION (英文完全非表示、ヒントも指示文ではなく意味を表示) ───
function DictationDrill({ items, onDone }: { items: DrillItem[]; onDone: (r: ('correct' | 'wrong')[]) => void }) {
  const [idx, setIdx] = useState(0); const [input, setInput] = useState(''); const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [results, setResults] = useState<('correct' | 'wrong' | null)[]>(items.map(() => null))
  const item = items[idx]; if (!item) return null
  const texts = getDrillTexts(item)
  const target = texts.target

  const check = () => { const r: 'correct' | 'wrong' = input.trim().toLowerCase().replace(/[.!?,]/g, '') === target.toLowerCase().replace(/[.!?,]/g, '') ? 'correct' : 'wrong'; setResult(r); const nr = [...results]; nr[idx] = r; setResults(nr) }
  const next = () => { if (idx + 1 >= items.length) { onDone(results.map(r => r || 'wrong')); return }; setIdx(idx + 1); setInput(''); setResult(null) }

  // 意味ヒント: 指示文ではなく、日本語の意味だけ表示
  const meaningHint = texts.jpDisplay || texts.meaningHint
  // 指示文パターンを検出して除外
  const isInstruction = meaningHint && (meaningHint.includes('選びなさい') || meaningHint.includes('にしなさい') || meaningHint.includes('書きなさい') || meaningHint.includes('英語に'))
  const showHint = meaningHint && !isInstruction

  return (
    <div className="space-y-3">
      <QProgress current={idx} total={items.length} results={results} />
      <QTag item={item} idx={idx} />
      <div className="bg-white rounded-xl p-6 border border-gray-200 text-center">
        <p className="text-sm text-gray-700 mb-4">下に聞き取った英語を書いてください</p>
        <button onClick={() => speak(target, 0.7)} className="w-16 h-16 mx-auto rounded-full bg-indigo-500 hover:bg-indigo-600 active:scale-95 flex items-center justify-center transition-all shadow-lg shadow-indigo-200"><Play size={28} className="text-white ml-1" /></button>
        <p className="text-xs text-gray-400 mt-3">何度でも再生できます</p>
        {showHint && <div className="mt-3 bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">意味のヒント: {meaningHint}</p></div>}
      </div>
      {result === null ? (
        <div>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && input.trim() && check()} placeholder="聞こえた英語を書こう..." autoComplete="off" className="w-full p-3 border-2 border-gray-200 rounded-xl text-lg focus:border-indigo-500 focus:outline-none" />
          <button onClick={check} disabled={!input.trim()} className="w-full mt-2 py-3 bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-40">チェック</button>
        </div>
      ) : (
        <div>
          <ResultBox result={result}>
            <p className={`font-bold ${result === 'correct' ? 'text-emerald-600' : 'text-red-500'}`}>{result === 'correct' ? '正解！' : '不正解'}</p>
            {result === 'wrong' && <p className="text-sm text-gray-600 mt-1">あなた: <span className="text-red-500">{input}</span></p>}
            <div className="flex items-center gap-2 mt-1"><p className="text-sm font-medium text-indigo-700">正答: {target}</p><SpeakerBtn text={target} /></div>
          </ResultBox>
          <button onClick={next} className="w-full mt-2 py-3 bg-indigo-500 text-white rounded-xl font-bold">{idx + 1 >= items.length ? '結果を見る' : '次へ →'}</button>
        </div>
      )}
    </div>
  )
}

// ─── REORDER (英語原文を隠し、日本語の意味を表示) ───
function ReorderDrill({ items, onDone }: { items: DrillItem[]; onDone: (r: ('correct' | 'wrong')[]) => void }) {
  const use = items.filter(i => getComplete(i).split(' ').length >= 3); const useItems = use.length > 0 ? use : items
  const [idx, setIdx] = useState(0); const [sel, setSel] = useState<string[]>([]); const [pool, setPool] = useState<string[]>([])
  const [result, setResult] = useState<'correct' | 'wrong' | null>(null)
  const [results, setResults] = useState<('correct' | 'wrong' | null)[]>(useItems.map(() => null))
  useEffect(() => { resetQ(0) }, [])
  const resetQ = (i: number) => {
    const item = useItems[i]; if (!item) return
    const texts = getDrillTexts(item)
    const t = texts.target.replace(/[.!?]/g, '')
    setPool(shuffle(t.split(' ').filter(Boolean))); setSel([]); setResult(null)
  }
  const item = useItems[idx]; if (!item) return null
  const texts = getDrillTexts(item)
  const target = texts.target.replace(/[.!?]/g, '').trim()

  const add = (w: string, pi: number) => { setSel([...sel, w]); const np = [...pool]; np.splice(pi, 1); setPool(np) }
  const rm = (si: number) => { if (result) return; setPool([...pool, sel[si]]); const ns = [...sel]; ns.splice(si, 1); setSel(ns) }
  const check = () => { const r: 'correct' | 'wrong' = sel.join(' ').toLowerCase() === target.toLowerCase() ? 'correct' : 'wrong'; setResult(r); const nr = [...results]; nr[idx] = r; setResults(nr) }
  const next = () => { if (idx + 1 >= useItems.length) { onDone(results.map(r => r || 'wrong')); return }; const ni = idx + 1; setIdx(ni); resetQ(ni) }
  return (
    <div className="space-y-3">
      <QProgress current={idx} total={useItems.length} results={results} />
      <QTag item={item} idx={idx} />
      <div className="bg-white rounded-xl p-4 border border-gray-200">
        <p className="text-sm text-gray-600 mb-1">下の単語を正しい順番に並べて英文を作ろう</p>
        {texts.jpDisplay ? <p className="text-base font-bold text-gray-800">{texts.jpDisplay}</p> : texts.meaningHint ? <p className="text-sm text-gray-600">{texts.meaningHint}</p> : <p className="text-sm text-gray-500">（{pool.length + sel.length}語の英文を作ろう）</p>}
      </div>
      <WordReorderUI pool={pool} sel={sel} onAdd={add} onRemove={rm} disabled={result !== null} />
      {result === null ? <button onClick={check} disabled={pool.length > 0} className="w-full py-3 bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-40">チェック</button> : (
        <div>
          <ResultBox result={result}>
            <p className={`font-bold ${result === 'correct' ? 'text-emerald-600' : 'text-red-500'}`}>{result === 'correct' ? '正解！' : '不正解'}</p>
            <div className="flex items-center gap-2 mt-1"><p className="text-sm font-medium text-indigo-700">{texts.target}</p><SpeakerBtn text={texts.target} /></div>
          </ResultBox>
          <button onClick={next} className="w-full mt-2 py-3 bg-indigo-500 text-white rounded-xl font-bold">{idx + 1 >= useItems.length ? '結果を見る' : '次へ →'}</button>
        </div>
      )}
    </div>
  )
}

const DRILL_MAP: Record<string, React.FC<{ items: DrillItem[]; onDone: (r: ('correct' | 'wrong')[]) => void }>> = {
  spelling: SpellingDrill, grammar: GrammarDrill, write3: Write3Drill, flashcard: FlashcardDrill, dictation: DictationDrill, reorder: ReorderDrill,
}

// ─── SUMMARY ───
function Summary({ wrongAnswers, drillResults, drillItems, setMode, onClose }: any) {
  const cc = drillResults.filter((r: string) => r === 'correct').length; const orig = wrongAnswers[0]
  const texts = orig ? getDrillTexts(orig) : { jpDisplay: '', enDisplay: '', target: '', meaningHint: '' }
  return <>
    <div className={`p-4 rounded-xl text-center ${cc === drillResults.length ? 'bg-emerald-50 border-2 border-emerald-200' : 'bg-amber-50 border-2 border-amber-200'}`}>
      {cc === drillResults.length ? <CheckCircle size={28} className="text-emerald-500 mx-auto mb-1" /> : <Sparkles size={28} className="text-amber-500 mx-auto mb-1" />}
      <p className="font-bold text-gray-800">{cc}/{drillResults.length} 正解</p>
    </div>
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
      <p className="text-xs font-bold text-indigo-700 mb-2 flex items-center gap-1"><BookOpen size={12} />復習ポイント</p>
      {texts.jpDisplay && <p className="text-sm text-gray-600 mb-1">{texts.jpDisplay}</p>}
      <div className="flex items-center gap-2 mb-1"><p className="text-base font-bold text-gray-800">{texts.enDisplay || orig?.question_text}</p><SpeakerBtn text={texts.target} /></div>
      {orig?.correct_answer && <p className="text-sm text-gray-700">正答: <span className="font-bold text-indigo-700">{orig.correct_answer}</span></p>}
      {orig?.explanation_jp && <p className="text-xs text-gray-500 mt-1">{orig.explanation_jp}</p>}
    </div>
    {drillItems?.length > 1 && drillItems[1]?.isGenerated && (
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
        <p className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1"><Sparkles size={12} />類似問題の復習</p>
        {(() => { const t2 = getDrillTexts(drillItems[1]); return <>
          {t2.jpDisplay && <p className="text-sm text-gray-600 mb-1">{t2.jpDisplay}</p>}
          <p className="text-sm font-bold text-gray-800 mb-1">{t2.enDisplay || drillItems[1].question_text}</p>
          <p className="text-sm text-gray-700">正答: <span className="font-bold text-purple-700">{drillItems[1].correct_answer}</span></p>
        </> })()}
      </div>
    )}
    <div className="flex gap-2">
      <button onClick={() => setMode('menu')} className="flex-1 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm font-medium">別のドリル</button>
      <button onClick={onClose} className="flex-1 py-2.5 bg-indigo-500 text-white rounded-xl text-sm font-bold">完了</button>
    </div>
  </>
}

// ─── FULLSCREEN MODAL WRAPPER ───
function DrillModal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  // bodyスクロール無効化
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col">
      {/* ヘッダーバー */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Dumbbell size={20} className="text-indigo-500" />
          <h2 className="font-bold text-gray-800">復習ドリル</h2>
        </div>
        <button onClick={onClose} className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
          <X size={16} />
          <span>閉じる</span>
        </button>
      </div>
      {/* コンテンツ（スクロール可能） */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto p-4 py-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── MAIN ───
export default function TestDrill({ wrongAnswers, onClose, initialMode, onDrillComplete }: { wrongAnswers: DrillItem[]; onClose: () => void; initialMode?: string; onDrillComplete?: () => void }) {
  const [mode, setMode] = useState<DrillMode>(initialMode && MODES.some(m => m.key === initialMode) ? initialMode as DrillMode : 'menu')
  const [loading, setLoading] = useState(false); const [drillItems, setDrillItems] = useState<DrillItem[]>([]); const [drillDone, setDrillDone] = useState(false); const [drillResults, setDrillResults] = useState<('correct' | 'wrong')[]>([])
  const [completeFired, setCompleteFired] = useState(false)

  // ドリル完了時にコールバック発火
  useEffect(() => {
    if (drillDone && !completeFired && onDrillComplete) {
      onDrillComplete()
      setCompleteFired(true)
    }
  }, [drillDone, completeFired, onDrillComplete])
  useEffect(() => {
    if (mode === 'menu' || mode === 'spelling') return
    setCompleteFired(false)
    let cancelled = false
    ;(async () => {
      setLoading(true); setDrillDone(false); setDrillResults([])
      const orig = wrongAnswers[0]; if (!orig) { setDrillItems(wrongAnswers); setLoading(false); return }
      try {
        const res = await fetch('/api/generate-similar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question_text: orig.question_text, question_text_jp: orig.question_text_jp, correct_answer: orig.correct_answer, question_type: orig.question_type, category: orig.category, explanation_jp: orig.explanation_jp }) })
        const sim = await res.json()
        if (!cancelled && sim && !sim.error) setDrillItems([{ ...orig, isGenerated: false }, { question_text: sim.question_text, question_text_jp: sim.question_text_jp, correct_answer: sim.correct_answer, explanation_jp: sim.explanation_jp, user_answer: '', question_type: orig.question_type, category: orig.category, isGenerated: true }])
        else if (!cancelled) setDrillItems([{ ...orig, isGenerated: false }])
      } catch { if (!cancelled) setDrillItems([{ ...orig, isGenerated: false }]) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [mode])

  if (!wrongAnswers.length) return null

  const mi = MODES.find(m => m.key === mode); const DC = DRILL_MAP[mode]
  const drillHeader = (back?: boolean) => (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        {back && <button onClick={() => setMode('menu')} className="text-sm text-indigo-600 flex items-center gap-0.5 hover:text-indigo-800"><ArrowLeft size={14} />メニュー</button>}
        {mi && <span className="text-indigo-500">{mi.icon}</span>}{mi && <h3 className="font-bold text-gray-800">{mi.label}{drillDone ? ' 完了！' : ''}</h3>}
      </div>
    </div>
  )

  // メニュー画面
  if (mode === 'menu') return (
    <DrillModal onClose={onClose}>
      <div className="space-y-4">
        <div>
          <p className="text-sm text-gray-600">元の問題 + AIが作った類似問題で練習できます</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className="p-4 bg-white border-2 border-gray-200 rounded-2xl text-left hover:border-indigo-300 hover:bg-indigo-50 transition-all active:scale-[0.98]">
              <div className="text-indigo-500 mb-2">{m.icon}</div>
              <p className="text-sm font-bold text-gray-800">{m.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>
    </DrillModal>
  )

  // スペル練習
  if (mode === 'spelling') return (
    <DrillModal onClose={onClose}>
      <div className="space-y-3">
        {drillHeader(true)}
        <SpellingDrill items={wrongAnswers} onDone={r => { setDrillResults(r); setDrillDone(true) }} />
        {drillDone && <Summary wrongAnswers={wrongAnswers} drillResults={drillResults} setMode={setMode} onClose={onClose} />}
      </div>
    </DrillModal>
  )

  // ローディング
  if (loading) return (
    <DrillModal onClose={onClose}>
      <div className="space-y-3">
        {drillHeader()}
        <div className="text-center py-12">
          <Sparkles size={32} className="text-indigo-400 mx-auto mb-3 animate-pulse" />
          <p className="text-gray-500">AIが類似問題を生成中...</p>
        </div>
      </div>
    </DrillModal>
  )

  // ドリル完了
  if (drillDone) return (
    <DrillModal onClose={onClose}>
      <div className="space-y-3">
        {drillHeader(true)}
        <Summary wrongAnswers={wrongAnswers} drillResults={drillResults} drillItems={drillItems} setMode={setMode} onClose={onClose} />
      </div>
    </DrillModal>
  )

  // ドリル実行中
  return (
    <DrillModal onClose={onClose}>
      <div className="space-y-3">
        {drillHeader(true)}
        {DC && <DC items={drillItems} onDone={r => { setDrillResults(r); setDrillDone(true) }} />}
      </div>
    </DrillModal>
  )
}
