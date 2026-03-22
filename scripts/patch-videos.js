const fs = require('fs')
const syl = JSON.parse(fs.readFileSync('src/data/grammar_syllabus.json', 'utf8'))

const BASE = 'https://www.youtube.com/watch?v=-d-CgIl1ce4'

const TIMESTAMPS = {
  'g1-03':'&t=570s','g1-05':'&t=570s','g1-07':'&t=632s','g1-08':'&t=632s',
  'g1-10':'&t=119s','g1-15':'&t=5005s','g1-16':'&t=834s','g1-18':'&t=834s',
  'g1-24':'&t=2867s',
  'g2-02':'&t=5761s','g2-03':'&t=5761s','g2-06':'&t=5463s','g2-09':'&t=6169s',
  'g2-10':'&t=3600s','g2-12':'&t=570s','g2-13':'&t=4241s','g2-14':'&t=4241s',
  'g2-15':'&t=4241s','g2-16':'&t=6525s','g2-17':'&t=6537s','g2-21':'&t=5761s',
  'g2-23':'&t=5761s','g2-24':'&t=5761s','g2-25':'&t=5761s',
  'g3-03':'&t=4241s','g3-04':'&t=4241s','g3-05':'&t=6525s','g3-06':'&t=6537s',
  'g3-08':'&t=570s','g3-09':'&t=3600s','g3-10':'&t=5761s','g3-11':'&t=5761s',
  'g3-12':'&t=3600s','g3-13':'&t=570s','g3-14':'&t=3600s','g3-15':'&t=0s',
  'g3-16':'&t=0s','g3-17':'&t=3600s','g3-18':'&t=3600s','g3-19':'&t=119s',
  'g3-20':'&t=3600s','g3-23':'&t=0s','g3-24':'&t=0s','g3-25':'&t=0s',
}

let added = 0
for (const grade of ['grade1','grade2','grade3']) {
  for (const unit of syl[grade]) {
    const ts = TIMESTAMPS[unit.id]
    if (!ts) continue
    if (!unit.videos) unit.videos = []
    const hasOsaru = unit.videos.some(v => v.channel === 'osaru' && !v.url.includes('placeholder'))
    if (!hasOsaru) {
      unit.videos.push({
        channel: 'osaru',
        title: '中学英語完全攻略 - ' + unit.title,
        url: BASE + ts,
        duration: '該当箇所へジャンプ'
      })
      added++
    }
  }
}

fs.writeFileSync('src/data/grammar_syllabus.json', JSON.stringify(syl, null, 2), 'utf8')
console.log('完了！追加:', added, '件')
