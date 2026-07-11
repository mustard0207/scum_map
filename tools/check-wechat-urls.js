/**
 * 直接验证 wechat_urls.json 中所有 URL 是否可访问
 * 不依赖 batchget API（该接口当前网络不稳定）
 */
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

function checkUrl(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.get(url, { timeout: 10000 }, (res) => {
      let data = ''
      res.on('data', () => {}) // 消耗响应体
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode }))
    })
    req.on('error', (e) => resolve({ ok: false, error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
  })
}

async function main() {
  const urls = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'wechat_urls.json'), 'utf8'))
  const keys = Object.keys(urls)
  console.log(`🔍 验证 wechat_urls.json 中 ${keys.length} 条 URL 的可达性\n`)

  const levels = { 3: [], 4: [], 6: [] }
  for (const key of keys) {
    const level = parseInt(key.split('_')[0])
    if (levels[level]) levels[level].push(key)
  }

  let ok = 0, fail = 0, errors = []
  let count = 0

  for (const level of [3, 4, 6]) {
    console.log(`\n📌 Z${level} 瓦片 (${levels[level].length} 张):`)
    for (const key of levels[level]) {
      const url = urls[key]
      const result = await checkUrl(url)
      count++
      if (result.ok) {
        ok++
      } else {
        fail++
        errors.push({ key, error: result.error || `HTTP ${result.status}` })
        process.stdout.write('❌')
      }
      if (count % 20 === 0) process.stdout.write(` [${count}/${keys.length}]\n`)
    }
    process.stdout.write(` ✅ ${levels[level].length} 张完成\n`)
  }

  console.log(`\n${'='.repeat(50)}`)
  console.log(`📊 验证结果:`)
  console.log(`   总数: ${keys.length}`)
  console.log(`   可达: ${ok} ✅`)
  console.log(`   失败: ${fail} ❌`)
  if (errors.length > 0) {
    console.log(`\n❌ 失败详情:`)
    errors.slice(0, 10).forEach(e => console.log(`   ${e.key}: ${e.error}`))
    if (errors.length > 10) console.log(`   ... 还有 ${errors.length - 10} 个`)
  } else {
    console.log(`\n🎉 全部 ${keys.length} 张瓦片在微信素材库中均正常可访问！`)
  }
}

main().catch(console.error)
