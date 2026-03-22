const s = require('./src/data/grammar_syllabus.json')
const all = [...s.grade1, ...s.grade2, ...s.grade3]
const noPlaceholder = all.filter(u => u.videos && u.videos.every(v => !v.url.includes('placeholder')))
const withOsaru = all.filter(u => u.videos && u.videos.some(v => v.channel === 'osaru'))
console.log('placeholderなし:', noPlaceholder.length, '/ 75件')
console.log('おさる動画あり:', withOsaru.length, '/ 75件')
console.log('サンプル:')
all.slice(0,5).forEach(u => {
  const v = u.videos && u.videos[0]
  if (v) console.log(' -', u.title, ':', v.url.slice(-20))
})
