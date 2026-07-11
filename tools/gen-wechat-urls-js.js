/**
 * 从 wechat_urls.json 生成 wechat-tile-urls.js 模块
 */
const fs = require('fs')
const path = require('path')

const urls = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'wechat_urls.json'), 'utf8'))
const keys = Object.keys(urls).sort()

let code = `// 微信公众号素材库瓦片 URL 映射表
// 自动生成，请勿手动编辑
const WECHAT_TILE_URLS = {
`

for (const key of keys) {
  code += `  '${key}': '${urls[key]}',\n`
}

code += `}

module.exports = WECHAT_TILE_URLS
`

const outPath = path.join(__dirname, '..', 'miniprogram', 'packageMap', 'components', 'tile-map', 'wechat-tile-urls.js')
fs.writeFileSync(outPath, code, 'utf8')
console.log('生成完成: ' + outPath)
console.log('共 ' + keys.length + ' 条记录')
console.log('文件大小: ' + (Buffer.byteLength(code) / 1024).toFixed(1) + ' KB')
