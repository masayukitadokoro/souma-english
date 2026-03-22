function kataToHira(s: string): string {
  return s.replace(/[\u30A1-\u30F6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60))
}
function normalize(s: string): string {
  return kataToHira(s.trim().replace(/\s+/g, '').replace(/　/g, '')).toLowerCase()
}
const SYNONYM_GROUPS: string[][] = [
  ['学生', '生徒', 'がくせい', 'せいと'],
  ['先生', '教師', 'せんせい', 'きょうし'],
  ['友達', '友だち', '友人', 'ともだち', 'ゆうじん'],
  ['お母さん', '母', 'おかあさん', 'はは', 'かあさん'],
  ['お父さん', '父', 'おとうさん', 'ちち', 'とうさん'],
  ['お兄さん', '兄', 'おにいさん', 'あに', 'にいさん'],
  ['お姉さん', '姉', 'おねえさん', 'あね', 'ねえさん'],
  ['弟', 'おとうと'],
  ['妹', 'いもうと'],
  ['家族', 'かぞく'],
  ['子供', '子ども', 'こども'],
  ['男の子', '男子', 'おとこのこ', 'だんし'],
  ['女の子', '女子', 'おんなのこ', 'じょし'],
  ['赤ちゃん', '赤ん坊', 'あかちゃん', 'あかんぼう'],
  ['ご飯', 'ごはん', '飯'],
  ['食べ物', 'たべもの'],
  ['飲み物', 'のみもの'],
  ['お弁当', '弁当', 'おべんとう', 'べんとう'],
  ['お茶', '茶', 'おちゃ', 'ちゃ'],
  ['お菓子', 'おかし', '菓子'],
  ['朝ご飯', '朝食', 'あさごはん', 'ちょうしょく'],
  ['昼ご飯', '昼食', 'ひるごはん', 'ちゅうしょく'],
  ['晩ご飯', '夕食', '夕ご飯', 'ばんごはん', 'ゆうしょく'],
  ['学校', 'がっこう'],
  ['病院', 'びょういん'],
  ['図書館', 'としょかん'],
  ['公園', 'こうえん'],
  ['家', '自宅', 'いえ', 'うち', 'じたく'],
  ['部屋', 'へや'],
  ['教室', 'きょうしつ'],
  ['お店', '店', 'おみせ', 'みせ'],
  ['今日', 'きょう'],
  ['明日', 'あした', 'あす'],
  ['昨日', 'きのう'],
  ['毎日', 'まいにち'],
  ['朝', 'あさ'],
  ['昼', 'ひる'],
  ['夜', 'よる'],
  ['勉強する', '勉強', 'べんきょうする', 'べんきょう'],
  ['練習する', '練習', 'れんしゅうする', 'れんしゅう'],
  ['使う', 'つかう'],
  ['遊ぶ', 'あそぶ'],
  ['食べる', 'たべる'],
  ['飲む', 'のむ'],
  ['見る', 'みる'],
  ['聞く', 'きく'],
  ['読む', 'よむ'],
  ['書く', 'かく'],
  ['話す', 'はなす'],
  ['歌う', 'うたう'],
  ['泳ぐ', 'およぐ'],
  ['知る', '知っている', 'しる', 'しっている'],
  ['住む', '住んでいる', 'すむ', 'すんでいる'],
  ['大きい', 'おおきい'],
  ['小さい', 'ちいさい'],
  ['新しい', 'あたらしい'],
  ['古い', 'ふるい'],
  ['良い', 'いい', 'よい'],
  ['悪い', 'わるい'],
  ['高い', 'たかい'],
  ['安い', 'やすい'],
  ['楽しい', 'たのしい'],
  ['嬉しい', 'うれしい'],
  ['難しい', 'むずかしい'],
  ['易しい', 'やさしい', '簡単', 'かんたん'],
  ['美しい', 'うつくしい', 'きれい', '綺麗'],
  ['面白い', 'おもしろい'],
  ['好き', 'すき'],
  ['嫌い', 'きらい'],
  ['元気', 'げんき'],
  ['上手', 'じょうず', 'うまい'],
  ['下手', 'へた'],
  ['有名', 'ゆうめい'],
  ['大切', 'たいせつ', '大事', 'だいじ'],
  ['本', 'ほん'],
  ['机', 'つくえ'],
  ['椅子', 'いす'],
  ['鞄', 'かばん', 'バッグ'],
  ['鉛筆', 'えんぴつ'],
  ['時計', 'とけい'],
  ['電話', 'でんわ'],
  ['自転車', 'じてんしゃ'],
  ['車', 'くるま'],
  ['天気', 'てんき'],
  ['花', 'はな'],
  ['山', 'やま'],
  ['川', 'かわ'],
  ['海', 'うみ'],
  ['空', 'そら'],
  ['たくさん', '沢山', 'いっぱい', '多い', 'おおい'],
  ['少し', 'すこし', 'ちょっと'],
  ['とても', 'すごく', '非常に', 'ひじょうに', 'たいへん', '大変'],
  ['全部', 'ぜんぶ', '全て', 'すべて'],
  ['一緒', 'いっしょ'],
  ['時々', 'ときどき'],
  ['いつも', '常に', 'つねに'],
]
const synonymMap = new Map<string, Set<string>>()
for (const group of SYNONYM_GROUPS) {
  const normalizedGroup = new Set(group.map(normalize))
  for (const word of normalizedGroup) {
    synonymMap.set(word, normalizedGroup)
  }
}
export function isJapaneseAnswerCorrect(userInput: string, correctAnswer: string): boolean {
  const u = normalize(userInput)
  const c = normalize(correctAnswer)
  if (u === c) return true
  const correctParts = correctAnswer.split(/[／\/、,]/).map(s => normalize(s))
  if (correctParts.some(p => p === u)) return true
  const userSynonyms = synonymMap.get(u)
  if (userSynonyms) {
    if (userSynonyms.has(c)) return true
    if (correctParts.some(p => userSynonyms.has(p))) return true
  }
  for (const cp of correctParts) {
    const correctSynonyms = synonymMap.get(cp)
    if (correctSynonyms && correctSynonyms.has(u)) return true
  }
  return false
}
export function isEnglishAnswerCorrect(userInput: string, correctAnswer: string): boolean {
  const u = userInput.trim().toLowerCase()
  const c = correctAnswer.trim().toLowerCase()
  if (u === c) return true
  const parts = correctAnswer.split(/[／\/]/).map(s => s.trim().toLowerCase())
  return parts.some(p => p === u)
}
