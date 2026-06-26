/**
 * POI 数据合并脚本
 *
 * 将 点位数据/分类/ 下的 102 个分类文件按 section 合并为 12 个文件。
 * 运行方式: node tools/merge-poi-data.js
 * 数据来源: category-map.js + 分类/*.js（直接从 scum-map.com 导出）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CAT_MAP = require(path.join(ROOT, '点位数据/category-map.js'));
const CAT_DIR = path.join(ROOT, '点位数据/分类');
const OUT_DIR = path.join(ROOT, 'miniprogram/packageMap/data/poi');

// 按 section 分组
const sections = {};
fs.readdirSync(CAT_DIR).filter(f => f.endsWith('.js')).forEach(f => {
  const catId = parseInt(f.split('-')[0]);
  const cat = CAT_MAP[catId];
  if (!cat) return;
  if (!sections[cat.section]) sections[cat.section] = [];
  // 读取并追加该分类的所有点位
  const points = require(path.join(CAT_DIR, f));
  points.forEach(p => {
    sections[cat.section].push({ id: p[0], cat: p[1], lng: p[2], lat: p[3], h: p[4] })
  });
});

// 确保输出目录存在
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// 输出
console.log('📦 POI 数据合并\n');
let totalSize = 0;
for (const [section, points] of Object.entries(sections)) {
  const fileName = `poi-${section}.js`;
  const content = 'module.exports = ' + JSON.stringify(points) + ';\n';
  fs.writeFileSync(path.join(OUT_DIR, fileName), content);
  const size = Buffer.byteLength(content, 'utf8');
  totalSize += size;
  console.log(`  ${fileName.padEnd(30)} ${(size/1024).toFixed(1).padStart(5)}KB  ${points.length} 个点位`);
}
console.log(`\n  合计: ${(totalSize/1024).toFixed(1)}KB (${Object.keys(sections).length} 个文件)`);
console.log('\n✅ 完成！');
