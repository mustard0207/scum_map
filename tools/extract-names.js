/**
 * SCUM Map Names Data Extractor
 *
 * 从 scum-map.com 前端 JS bundle 中提取地名标签数据：
 * - 桥梁名称 (Bridge names)
 * - 城市/村庄名称 (Cities & village names)
 * - 街道名称 (Street names, Samobor 地区)
 *
 * 数据来源：前端 JS bundle 中硬编码的数据，非 GraphQL API
 * 运行方式: node tools/extract-names.js
 *
 * 依赖: Node.js 18+ (内置 fetch)
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  // 从 scum-map.com HTML 中提取的 JS bundle URL
  // 注意：版本号会更新，需要从页面 HTML 中获取最新的 URL
  bundleUrl: 'https://cdn.scum-map.com/v65.1.2026.07.08/build/4c3b26a5678027ec1c75.app.js',
  outputDir: path.join(__dirname, '..', '点位数据', '地名数据'),

  // 坐标转换系数（从网站坐标 → 游戏内坐标）
  // ingameLongitude = A_LNG * lng + B_LNG
  // ingameLatitude  = A_LAT * lat + B_LAT
  A_LNG: -4754.373947266854,
  B_LNG: 617900.0126173416,
  A_LAT: -4756.735350141481,
  B_LAT: 617499.8899900347,
};

// 中文翻译映射表（从 scum-map.com i18n 翻译数据中提取）
// 更新时可从翻译响应文件中重新提取
const CN_TRANSLATIONS = {
  // 桥梁
  'Dr. Tuđman Bridge': '涂们医生大桥',
  'Krk Bridge': '克尔克桥',
  'Pelješac Bridge': '佩列沙茨大桥',

  // 城市/村庄（从翻译文件中匹配到的）
  'Samobor': '萨默玻尔城',
  'Novigrad': '诺维格瑞',
  'Rogoznica': '罗折尼卡',
  'Slani Dol': '斯拉特',
  'Drvenik': '旦喂尼',
  'Jelsa': '浙沙',
  'Brela': '布雷拉',
  'Murvica': '默尔维卡',
  'Lobor': '叻波',
  'Selca': '沙卡',
  'Gdinj': '吉迪尼',
  'Novo Selo': '挪莫希洛',

  // 街道（Samobor 地区，以城市名命名）
  'Ankara Street': '安卡拉街',
  'Monaco Street': '摩纳哥街',
  'Washington Street': '华盛顿街',
  'Sarajevo Street': '萨拉热窝街',
  'Warsaw Street': '华沙街',
  'Ljubljana Street': '卢布尔雅那街',
  'Paris Street': '巴黎街',
  'Madrid Street': '马德里街',
  'Samobor Street': '萨默玻尔街',
  'Zagreb Street': '萨格勒布街',
  'Oslo Street': '奥斯陆街',
  'Bern Street': '伯尔尼街',
  'Stockolm Street': '斯德哥尔摩街',
  'Bucharest Street': '布加勒斯特街',
  'Velebit Street': '韦莱比特街',
  'Vatican Street': '梵蒂冈街',
  'London Street': '伦敦街',
  'Rome Street': '罗马街',
  'Minsk Street': '明斯克街',
  'San Marino Street': '圣马力诺街',
};

// ============================================================
// 工具函数
// ============================================================

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function webCoordToGameCoord(lng, lat) {
  return {
    igLng: CONFIG.A_LNG * lng + CONFIG.B_LNG,
    igLat: CONFIG.A_LAT * lat + CONFIG.B_LAT,
  };
}

function getCnName(name) {
  return CN_TRANSLATIONS[name] || null;
}

// ============================================================
// 主逻辑
// ============================================================

async function main() {
  console.log('📍 SCUM 地名标签数据提取器');
  console.log('='.repeat(50));

  // 确保输出目录存在
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Step 1: 下载 JS bundle
  console.log('\n📦 步骤 1: 下载前端 JS bundle...');
  console.log('   URL:', CONFIG.bundleUrl);
  const js = await fetch(CONFIG.bundleUrl);
  console.log('   大小:', (js.length / 1024 / 1024).toFixed(1), 'MB');

  // Step 2: 提取桥梁和城市/村庄名称
  console.log('\n📍 步骤 2: 提取桥梁 + 城市/村庄名称...');
  const nameRegex = /\{lng:([0-9.]+),lat:([0-9.]+)\},"([^"]+)"/g;
  const allNames = [];
  let m;
  while ((m = nameRegex.exec(js)) !== null) {
    const name = m[3].replace(/<br\s*\/?>/g, ' ');
    const { igLng, igLat } = webCoordToGameCoord(parseFloat(m[1]), parseFloat(m[2]));
    allNames.push({
      name,
      cn: getCnName(name),
      webLng: parseFloat(m[1]),
      webLat: parseFloat(m[2]),
      igLng: Math.round(igLng * 1000) / 1000,
      igLat: Math.round(igLat * 1000) / 1000,
    });
  }

  const bridges = allNames.filter(n => /bridge/i.test(n.name)).map(b => ({
    name: b.name, cn: b.cn, igLng: b.igLng, igLat: b.igLat,
  }));

  // 城市/村庄去重
  const seen = new Set();
  const cities = [];
  for (const n of allNames.filter(n => !/bridge/i.test(n.name))) {
    if (!seen.has(n.name)) {
      seen.add(n.name);
      cities.push({ name: n.name, cn: n.cn, igLng: n.igLng, igLat: n.igLat });
    }
  }

  console.log('   桥梁:', bridges.length, '个');
  console.log('   城市/村庄:', cities.length, '个（去重后）');

  // 保存桥梁数据
  const bridgesPath = path.join(CONFIG.outputDir, 'bridge-names.json');
  fs.writeFileSync(bridgesPath, JSON.stringify(bridges, null, 2));
  console.log('   保存到:', bridgesPath);

  // 保存城市/村庄数据
  const citiesPath = path.join(CONFIG.outputDir, 'city-village-names.json');
  fs.writeFileSync(citiesPath, JSON.stringify(cities, null, 2));
  console.log('   保存到:', citiesPath);

  // Step 3: 提取街道名称（含路径和门牌号）
  console.log('\n🛣️  步骤 3: 提取街道名称 (Samobor 地区)...');
  const streets = [];
  const namePattern = /name:"([^"]+Street)"/g;
  let nm;
  while ((nm = namePattern.exec(js)) !== null) {
    const streetName = nm[1];
    const startPos = nm.index;
    const chunk = js.substring(startPos, startPos + 5000);

    // 解析标签位置
    const coordsMatch = chunk.match(/nameCoords:"X=([0-9.]+) Y=([0-9.]+) Z=([0-9.]+)"/);
    const rotateMatch = chunk.match(/nameRotate:([0-9.-]+)/);
    const colorMatch = chunk.match(/color:"([^"]+)"/);

    // 解析 polylineList（街道路径，网站坐标）
    const polyStart = chunk.indexOf('polylineList:[');
    let polyline = [];
    if (polyStart !== -1) {
      let bracketCount = 0;
      let polyEnd = polyStart + 14;
      bracketCount = 1;
      for (let i = polyEnd; i < chunk.length; i++) {
        if (chunk[i] === '[') bracketCount++;
        if (chunk[i] === ']') bracketCount--;
        if (bracketCount === 0) { polyEnd = i + 1; break; }
      }
      const fullPoly = chunk.substring(polyStart + 13, polyEnd);
      const pointRegex = /\[([0-9.]+),([0-9.]+)\]/g;
      let pm;
      while ((pm = pointRegex.exec(fullPoly)) !== null) {
        const wlng = parseFloat(pm[1]);
        const wlat = parseFloat(pm[2]);
        const { igLng, igLat } = webCoordToGameCoord(wlng, wlat);
        polyline.push({ webLng: wlng, webLat: wlat, igLng: Math.round(igLng * 1000) / 1000, igLat: Math.round(igLat * 1000) / 1000 });
      }
    }

    // 解析 numberList（门牌号，游戏坐标）
    const numStart = chunk.indexOf('numberList:[');
    let numberList = [];
    if (numStart !== -1) {
      const numChunk = chunk.substring(numStart);
      const numRegex = /\{number:(\d+),coords:"X=([0-9.]+) Y=([0-9.]+) Z=([0-9.]+)"\}/g;
      let numMatch;
      while ((numMatch = numRegex.exec(numChunk)) !== null) {
        if (numMatch.index > 200) break;
        numberList.push({
          number: parseInt(numMatch[1]),
          igX: parseFloat(numMatch[2]),
          igY: parseFloat(numMatch[3]),
          igZ: parseFloat(numMatch[4]),
        });
      }
    }

    streets.push({
      name: streetName,
      cn: getCnName(streetName),
      igX: coordsMatch ? parseFloat(coordsMatch[1]) : 0,
      igY: coordsMatch ? parseFloat(coordsMatch[2]) : 0,
      igZ: coordsMatch ? parseFloat(coordsMatch[3]) : 0,
      rotate: rotateMatch ? parseFloat(rotateMatch[1]) : 0,
      color: colorMatch ? colorMatch[1] : '#3388ff',
      polyline,
      numberList,
    });
  }

  console.log('   街道:', streets.length, '条');

  // 保存街道数据
  const streetsPath = path.join(CONFIG.outputDir, 'street-names.json');
  fs.writeFileSync(streetsPath, JSON.stringify(streets, null, 2));
  console.log('   保存到:', streetsPath);

  // Step 4: 生成汇总
  console.log('\n📊 步骤 4: 生成汇总...');
  const summary = {
    version: '1.0',
    source: 'scum-map.com JS bundle',
    bundleUrl: CONFIG.bundleUrl,
    extractDate: new Date().toISOString(),
    conversionFormula: {
      ingameLongitude: `${CONFIG.A_LNG} * webLng + ${CONFIG.B_LNG}`,
      ingameLatitude: `${CONFIG.A_LAT} * webLat + ${CONFIG.B_LAT}`,
    },
    counts: {
      bridges: bridges.length,
      citiesVillages: cities.length,
      streets: streets.length,
    },
    translationStats: {
      bridges: `${bridges.filter(b => b.cn).length}/${bridges.length}`,
      citiesVillages: `${cities.filter(c => c.cn).length}/${cities.length}`,
      streets: `${streets.filter(s => s.cn).length}/${streets.length}`,
    },
    samples: {
      bridges: bridges.slice(0, 3),
      cities: cities.slice(0, 5),
      streets: streets.slice(0, 5),
    },
  };

  const summaryPath = path.join(CONFIG.outputDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('   保存到:', summaryPath);

  // 完成
  console.log('\n' + '='.repeat(50));
  console.log('✅ 地名数据提取完成！');
  console.log(`   桥梁: ${bridges.length} 个 (中文: ${bridges.filter(b => b.cn).length})`);
  console.log(`   城市/村庄: ${cities.length} 个 (中文: ${cities.filter(c => c.cn).length})`);
  console.log(`   街道: ${streets.length} 条 (中文: ${streets.filter(s => s.cn).length})`);
  console.log(`   目录: ${CONFIG.outputDir}`);

  // 打印预览
  console.log('\n📍 桥梁预览:');
  bridges.forEach(b => console.log(`   ${b.name}${b.cn ? ' (' + b.cn + ')' : ''} → (${b.igLng}, ${b.igLat})`));

  console.log('\n🏘️  城市/村庄预览 (有中文翻译的):');
  cities.filter(c => c.cn).forEach(c => console.log(`   ${c.name} → ${c.cn}`));

  console.log('\n🛣️  街道预览 (有中文翻译的):');
  streets.filter(s => s.cn).forEach(s => console.log(`   ${s.name} → ${s.cn} (${s.polyline.length} 点, ${s.numberList.length} 门牌)`));
}

main().catch(err => {
  console.error('💥 致命错误:', err.message);
  process.exit(1);
});
