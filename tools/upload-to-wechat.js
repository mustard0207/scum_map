/**
 * 微信公众号素材库批量上传脚本
 *
 * 功能：将瓦片图片上传到微信公众号永久素材库，收集返回的 URL
 * 用法：node tools/upload-to-wechat.js
 *
 * 输出：
 *   - wechat_urls.json  — 所有瓦片的微信素材库 URL（供代码使用）
 *   - upload_report.json — 上传结果报告
 */

const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

// ============ 配置 ============
const APPID = 'wx3e73df893f0b2472'
const APPSECRET = '3b1dade41ccddc783d95d9b4ef4de9b1'

// 要上传的瓦片级别（与代码 TILE_LEVELS 对应）
const UPLOAD_LEVELS = [3, 4, 6]

// 瓦片目录
const TILES_DIR = path.join(__dirname, '..', 'tiles')

// 上传间隔（毫秒），避免触发频率限制
const UPLOAD_INTERVAL = 500

// ============ 工具函数 ============

/** 发起 HTTPS/HTTP 请求 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http
    const req = mod.request(url, options, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) })
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data })
        }
      })
    })
    req.on('error', reject)
    if (options.body) req.write(options.body)
    req.end()
  })
}

/** 获取 access_token */
async function getAccessToken() {
  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
  const res = await request(url)
  if (res.body.access_token) {
    console.log('✅ access_token 获取成功')
    return res.body.access_token
  }
  throw new Error(`获取 access_token 失败: ${JSON.stringify(res.body)}`)
}

/** 构造 multipart/form-data 请求体 */
function buildMultipartBody(filePath, filename) {
  const boundary = '----FormBoundary' + Math.random().toString(36).slice(2)
  const fileData = fs.readFileSync(filePath)

  const parts = []
  parts.push(Buffer.from(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="media"; filename="${filename}"\r\n` +
    `Content-Type: image/webp\r\n\r\n`
  ))
  parts.push(fileData)
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`))

  return { body: Buffer.concat(parts), boundary }
}

/** 上传单张图片到微信素材库 */
async function uploadImage(filePath, filename, token) {
  const url = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${token}&type=image`
  const { body, boundary } = buildMultipartBody(filePath, filename)

  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          resolve({ errcode: -1, errmsg: data })
        }
      })
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/** 延时 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ============ 主流程 ============

async function main() {
  console.log('🚀 微信公众号素材库批量上传工具')
  console.log('='.repeat(50))

  // 1. 获取 access_token
  const token = await getAccessToken()

  // 2. 扫描瓦片文件
  const tiles = []
  for (const level of UPLOAD_LEVELS) {
    const levelDir = path.join(TILES_DIR, String(level))
    if (!fs.existsSync(levelDir)) {
      console.warn(`⚠️  目录不存在: ${levelDir}`)
      continue
    }
    const files = fs.readdirSync(levelDir).filter(f => f.endsWith('.webp')).sort()
    for (const file of files) {
      // 文件名格式: {col}_{row}.webp
      const match = file.match(/^(\d+)_(\d+)\.webp$/)
      if (!match) continue
      const col = parseInt(match[1])
      const row = parseInt(match[2])
      tiles.push({
        level,
        col,
        row,
        key: `${level}_${col}_${row}`,
        file: path.join(levelDir, file),
        filename: `${level}_${col}_${row}.webp`
      })
    }
  }

  console.log(`\n📦 发现 ${tiles.length} 张瓦片待上传：`)
  for (const level of UPLOAD_LEVELS) {
    const count = tiles.filter(t => t.level === level).length
    if (count > 0) console.log(`   Z${level}: ${count} 张`)
  }

  // 3. 确认上传
  console.log('\n⚠️  即将开始上传，Ctrl+C 可取消')
  await sleep(2000)

  // 4. 逐个上传
  const results = {}
  const errors = []
  let successCount = 0

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i]
    const progress = `[${i + 1}/${tiles.length}]`

    process.stdout.write(`${progress} 上传 ${tile.key} ... `)

    try {
      const res = await uploadImage(tile.file, tile.filename, token)

      if (res.url) {
        results[tile.key] = res.url
        successCount++
        console.log(`✅ ${res.url.substring(0, 60)}...`)
      } else if (res.errcode === 45064 || res.errcode === 45009) {
        // 频率限制，等待后重试
        console.log(`⏳ 触发频率限制，等待 5 秒后重试...`)
        await sleep(5000)
        const retry = await uploadImage(tile.file, tile.filename, token)
        if (retry.url) {
          results[tile.key] = retry.url
          successCount++
          console.log(`   ✅ 重试成功`)
        } else {
          errors.push({ key: tile.key, error: retry })
          console.log(`   ❌ 重试失败: ${JSON.stringify(retry)}`)
        }
      } else {
        errors.push({ key: tile.key, error: res })
        console.log(`❌ ${JSON.stringify(res)}`)
      }
    } catch (err) {
      errors.push({ key: tile.key, error: err.message })
      console.log(`❌ ${err.message}`)
    }

    // 间隔避免频率限制
    if (i < tiles.length - 1) {
      await sleep(UPLOAD_INTERVAL)
    }
  }

  // 5. 输出结果
  console.log('\n' + '='.repeat(50))
  console.log(`📊 上传完成: 成功 ${successCount}/${tiles.length}, 失败 ${errors.length}`)

  // 保存 URL 映射（供代码使用）
  const outputPath = path.join(__dirname, '..', 'wechat_urls.json')
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf-8')
  console.log(`\n💾 URL 映射已保存: ${outputPath}`)

  // 保存上传报告
  const report = {
    timestamp: new Date().toISOString(),
    total: tiles.length,
    success: successCount,
    failed: errors.length,
    urls: results,
    errors
  }
  const reportPath = path.join(__dirname, '..', 'upload_report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`📋 上传报告已保存: ${reportPath}`)

  if (errors.length > 0) {
    console.log('\n❌ 失败的瓦片:')
    errors.forEach(e => console.log(`   ${e.key}: ${JSON.stringify(e.error).substring(0, 100)}`))
  }
}

main().catch(err => {
  console.error('💥 脚本执行出错:', err.message)
  process.exit(1)
})
