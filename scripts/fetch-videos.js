const fs = require('fs')
const path = require('path')

const API_KEY = process.env.YOUTUBE_API_KEY
if (!API_KEY) { console.error('❌ YOUTUBE_API_KEY が未設定'); process.exit(1) }

const CHANNELS = {
  naoeigo: 'UCYlld48Qips02zzzmanVuZA',
  osaru:   'UCZikuEIssIzv0fdkVEH7Djg',
}

const KEYWORDS = {
  'g1-01':['アルファベット','発音'],'g1-02':['be動詞','am is are','be動詞①'],
  'g1-03':['be動詞 否定','否定文 疑問文','be動詞②'],'g1-04':['一般動詞','一般動詞①'],
  'g1-05':['一般動詞 否定',"don't",'一般動詞②'],'g1-06':['三単現','三人称単数','三人称'],
  'g1-07':['疑問詞 what','what who','疑問詞①'],'g1-08':['疑問詞 where','when where','疑問詞②'],
  'g1-09':['代名詞','my me'],'g1-10':['this that','指示代名詞'],
  'g1-11':['形容詞'],'g1-12':['副詞'],
  'g1-13':['現在進行形','ing形'],'g1-14':['命令文','感嘆文'],
  'g1-15':['can','canの'],'g1-16':['規則動詞','過去形 規則','ed 過去'],
  'g1-17':['不規則動詞','過去形 不規則','不規則'],'g1-18':['was were','be動詞 過去形'],
  'g1-19':['過去進行形'],'g1-20':['will','未来形 will','willの'],
  'g1-21':['be going to','going to'],'g1-22':['前置詞','in on at'],
  'g1-23':['接続詞','because and but'],'g1-24':['複数形','名詞の複数'],
  'g1-25':['there is','there are'],
  'g2-01':['不定詞 名詞','want to','不定詞①'],'g2-02':['不定詞 副詞','不定詞②'],
  'g2-03':['不定詞 形容詞','不定詞③'],'g2-04':['動名詞'],
  'g2-05':['must','have to'],'g2-06':['should','may might'],
  'g2-07':['比較級','比較①'],'g2-08':['最上級','比較②'],
  'g2-09':['as as','同等比較','比較③'],'g2-10':['when if that','従属接続詞'],
  'g2-11':['受動態','受動態①'],'g2-12':['受動態 否定','受動態②'],
  'g2-13':['現在完了 経験','現在完了①'],'g2-14':['現在完了 完了','現在完了②'],
  'g2-15':['現在完了 継続','for since','現在完了③'],
  'g2-16':['関係代名詞 who','関係代名詞①'],'g2-17':['関係代名詞 which','関係代名詞②'],
  'g2-18':['間接疑問文'],'g2-19':['付加疑問文'],
  'g2-20':['感嘆文'],'g2-21':['形式主語','it is to'],
  'g2-22':['SVOO SVOC','第4文型'],'g2-23':['tell ask want'],
  'g2-24':['使役動詞','let make help'],'g2-25':['現在分詞 形容詞'],
  'g3-01':['仮定法','仮定法①'],'g3-02':['i wish','仮定法②'],
  'g3-03':['現在完了進行形'],'g3-04':['過去完了'],
  'g3-05':['関係副詞'],'g3-06':['関係代名詞 省略'],
  'g3-07':['分詞構文'],'g3-08':['受動態 応用'],
  'g3-09':['that節','名詞節'],'g3-10':['疑問詞 不定詞','what to how to'],
  'g3-11':['too to','enough to'],'g3-12':['so that'],
  'g3-13':['準否定語'],'g3-14':['強調構文','倒置'],
  'g3-15':['会話表現'],'g3-16':['依頼 提案'],
  'g3-17':['長文読解'],'g3-18':['however therefore'],
  'g3-19':['英作文 語順'],'g3-20':['英作文 接続'],
  'g3-21':['リスニング'],'g3-22':['自己紹介'],
  'g3-23':['意見 英語'],'g3-24':['英検3級'],
  'g3-25':['職人 英語','ものづくり 英語'],
}

async function fetchAllVideos(channelId) {
  const videos = []
  let nextPageToken = ''
  let page = 0
  
  do {
    const url = `https://www.googleapis.com/youtube/v3/search?key=${API_KEY}&channelId=${channelId}&part=snippet&type=video&maxResults=50&order=date${nextPageToken ? '&pageToken=' + nextPageToken : ''}`
    const res = await fetch(url)
    const data = await res.json()
    if (data.error) { console.error('  API Error:', data.error.message); break }
    
    const items = (data.items || []).map(i => ({
      videoId: i.id.videoId,
      title: i.snippet.title,
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`
    }))
    videos.push(...items)
    nextPageToken = data.nextPageToken || ''
    page++
    if (page > 10) break // 最大500件で止める
  } while (nextPageToken)
  
  return videos
}

function match(videos, keywords) {
  for (const kw of keywords) {
    const v = videos.find(v => v.title.includes(kw) || v.title.toLowerCase().includes(kw.toLowerCase()))
    if (v) return v
  }
  return null
}

async function main() {
  console.log('🔍 YouTube動画を全件取得中（ページネーション使用）...')
  const ch = {}
  for (const [k, id] of Object.entries(CHANNELS)) {
    console.log(`  ${k}...`)
    ch[k] = await fetchAllVideos(id)
    console.log(`  → ${ch[k].length}件取得`)
  }

  const p = path.join(__dirname, '../src/data/grammar_syllabus.json')
  const syl = JSON.parse(fs.readFileSync(p, 'utf8'))
  let matched = 0, notFound = []

  for (const grade of ['grade1','grade2','grade3']) {
    for (const unit of syl[grade]) {
      const kws = KEYWORDS[unit.id] || [unit.title]
      const vids = []
      const n = match(ch.naoeigo || [], kws)
      if (n) { vids.push({channel:'naoeigo', title:n.title, url:n.url, duration:'約10分'}); matched++ }
      const o = match(ch.osaru || [], kws)
      if (o) vids.push({channel:'osaru', title:o.title, url:o.url, duration:'約12分'})
      if (vids.length > 0) unit.videos = vids
      else notFound.push(unit.id + ': ' + unit.title)
    }
  }

  fs.writeFileSync(p, JSON.stringify(syl, null, 2), 'utf8')
  console.log(`\n✅ 完了！マッチ: ${matched}件 / 未マッチ: ${notFound.length}件`)
  if (notFound.length) { console.log('\n未マッチ:'); notFound.forEach(n => console.log(' -', n)) }
}

main().catch(console.error)
