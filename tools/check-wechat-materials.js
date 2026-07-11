/**
 * 检查微信公众号永久素材库中的瓦片图片
 *
 * 用法：node tools/check-wechat-materials.js
 * 依赖：根目录 wechat_urls.json（对比用）
 */
const fs = require('fs')
const path = require('path')

const APPID = 'wx3e73df893f0b2472'
const APPSECRET = '3b1dade41ccddc783d95d9b4ef4de9b1'

function request(url, options = {}, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const http = require(url.startsWith('https') ? 'https' : 'http')
    const req = http.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try { resolve({ statusCode: res.statusCode, body: JSON.parse(data) }) }
        catch (e) { resolve({ statusCode: res.statusCode, body: data }) }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeout, () => { req.destroy(); reject(new Error('timeout')) })
    if (options.body) req.write(options.body)
    req.end()
  })
}

async function getAccessToken() {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  const res = await request(url)
  if (res.body.access_token) {
    console.log('✅ access_token 获取成功')
    return res.body.access_token
  }
  throw new Error(`获取 access_token 失败: ${JSON.stringify(res.body)}`)
}

async function getMaterialCount(token) {
  const url = `https://api.weixin.qq.com/cgi-bin/material/get_materialcount?access_token=${token}`
  const res = await request(url)
  return res.body
}

async function batchGetMaterials(token, offset, count, retries = 3) {
  const url = `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${token}`
  const body = JSON.stringify({ type: 'image', offset, count })
  for (let i = 0; i < retries; i++) {
    try {
      const res = await request(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
      }, 30000)
      return res.body
    } catch (e) {
      if (i < retries - 1) {
        console.log(`     重试 ${i + 1}/${retries}...`)
        await new Promise(r => setTimeout(r, 2000))
      } else {
        throw e
      }
    }
  }
}

async function checkUrlAccessible(url) {
  return new Promise((resolve) => {
    const mod = url.startsWith('https') ? https : require('http')
    const req = mod.get(url, { timeout: 8000 }, (res) => {
      resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode })
      res.resume()
    })
    req.on('error', (e) => resolve({ ok: false, error: e.message }))
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, error: 'timeout' }) })
  })
}

async function main() {
  console.log('🔍 微信公众号永久素材库检查工具')
  console.log('='.repeat(50))

  // 1. 获取 token
  const token = await getAccessToken()

  // 2. 获取素材总数
  const countInfo = await getMaterialCount(token)
  console.log(`\n📊 素材库统计:`)
  console.log(`   图片: ${countInfo.image_count} 个`)
  console.log(`   视频: ${countInfo.video_count} 个`)
  console.log(`   语音: ${countInfo.voice_count} 个`)
  console.log(`   图文: ${countInfo.news_count} 个`)

  // 3. 分批拉取所有图片素材列表
  console.log(`\n📋 正在拉取图片素材列表...`)
  let allItems = []
  let offset = 0
  const PAGE_SIZE = 20

  while (true) {
    try {
      const data = await batchGetMaterials(token, offset, PAGE_SIZE)
      if (data.errcode) {
        console.error(`❌ 拉取失败:`, JSON.stringify(data))
        break
      }
      const items = data.item || []
      allItems = allItems.concat(items)
      console.log(`   已拉取 ${allItems.length}/${countInfo.image_count || '?'}`)
      if (items.length < PAGE_SIZE) break
      offset += PAGE_SIZE
    } catch (e) {
      console.error(`   拉取出错: ${e.message}`)
      break
    }
  }

  console.log(`\n📦 共获取 ${allItems.length} 个图片素材`)

  // 4. 加载本地 wechat_urls.json 做对比
  const urlsPath = path.join(__dirname, '..', 'wechat_urls.json')
  let localUrls = {}
  let localCount = 0
  if (fs.existsSync(urlsPath)) {
    localUrls = JSON.parse(fs.readFileSync(urlsPath, 'utf8'))
    localCount = Object.keys(localUrls).length
    console.log(`📄 本地记录: wechat_urls.json 中有 ${localCount} 条瓦片 URL`)
  }

  // 5. 分析素材中的瓦片
  const tileItems = allItems.filter(item => {
    const name = (item.name || '').toLowerCase()
    return name.endsWith('.webp') || name.endsWith('.jpg') || name.endsWith('.jpeg')
  })
  console.log(`\n🏷️  素材库中图片素材总览:`)
  console.log(`   总数: ${allItems.length}`)
  console.log(`   疑似瓦片: ${tileItems.length}`)

  // 6. 按瓦片层级分组统计
  const levelCounts = { 3: 0, 4: 0, 6: 0, other: 0 }
  const levelNames = { 3: 'Z3 (2×2)', 4: 'Z4 (4×4)', 6: 'Z6 (16×16)' }
  const foundUrls = new Set()

  for (const item of tileItems) {
    const name = item.name || ''
    const match = name.match(/^(\d+)_\d+_\d+/)
    if (match && levelCounts[match[1]] !== undefined) {
      levelCounts[match[1]]++
    } else {
      levelCounts.other++
    }
    foundUrls.add(item.url)
  }

  for (const [level, label] of Object.entries(levelNames)) {
    console.log(`   ${label}: ${levelCounts[level]} 张`)
  }
  if (levelCounts.other > 0) console.log(`   其他: ${levelCounts.other} 张`)

  // 7. 对比本地 wechat_urls.json
  if (localCount > 0) {
    console.log(`\n🔎 对比本地记录:`)
    let matched = 0
    let missing = []
    for (const [key, url] of Object.entries(localUrls)) {
      if (foundUrls.has(url)) {
        matched++
      } else {
        missing.push(key)
      }
    }
    console.log(`   匹配成功: ${matched}/${localCount}`)
    if (missing.length > 0) {
      console.log(`   缺失瓦片:`)
      missing.slice(0, 20).forEach(k => console.log(`     - ${k}`))
      if (missing.length > 20) console.log(`     ... 还有 ${missing.length - 20} 个`)
    } else if (matched === localCount) {
      console.log(`   ✅ 全部 ${localCount} 张瓦片均在素材库中找到！`)
    }

    // 8. 抽样验证 URL 可访问性
    console.log(`\n🌐 抽样 URL 可达性检测（取 10 个样本）:`)
    const sampleKeys = Object.keys(localUrls).slice(0, 10)
    let accessible = 0
    for (const key of sampleKeys) {
      const url = localUrls[key]
      const result = await checkUrlAccessible(url)
      const status = result.ok ? '✅' : '❌'
      if (result.ok) accessible++
      console.log(`   ${status} ${key}: ${result.ok ? `HTTP ${result.status}` : result.error}`)
    }
    console.log(`   抽样可达: ${accessible}/${sampleKeys.length}`)
  }

  // 9. 检查素材名称格式
  console.log(`\n📝 素材名称样例（前 5 个）:`)
  allItems.slice(0, 5).forEach(item => {
    console.log(`   [${item.media_id?.substring(0, 20)}...] name=${item.name}, update_time=${new Date(item.update_time * 1000).toLocaleString()}`)
  })

  console.log('\n' + '='.repeat(50))
  console.log('检查完毕')
}

main().catch(err => {
  console.error('💥 出错:', err.message)
  process.exit(1)
})
