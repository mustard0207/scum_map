/**
 * SCUM Map POI Data Scraper
 *
 * 从 scum-map.com GraphQL API 抓取所有 POI 分类和标记点数据
 * 运行方式: node tools/poi-scraper.js
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
  graphqlUrl: 'https://scum-map.com/zh-CN/gql/',
  mapTemplateId: '01JTAKS9ACWQCZJTZ1R1N573KD', // SCUM Island 地图模板 ID
  outputDir: path.join(__dirname, '..', 'data'),
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://scum-map.com/zh-CN/scum/island/',
    'Origin': 'https://scum-map.com'
  }
};

// ============================================================
// GraphQL 查询
// ============================================================

const QUERIES = {
  // 获取所有分类（包含section分组信息）
  categories: `query GetMapTemplateCategoryList($mapTemplateId: MapTemplateIdAtMapScalar!) {
    mapCategory {
      listForMapTemplate(mapTemplateId: $mapTemplateId) {
        id
        name
        section {
          name
        }
        appearance {
          color
          colorBackground
          icon
        }
      }
    }
  }`,

  // 获取指定分类的标记点
  markers: `query GetMapPageLayerList($categoryIdList: [Int!]!, $urlId: MapByUrlIdScalar, $includeWithoutCategory: Boolean!) {
    mapLayer {
      list(categoryIdList: $categoryIdList, urlId: $urlId, includeWithoutCategory: $includeWithoutCategory) {
        ... on MapLayerMarker {
          id
          urlId
          title
          icon
          number
          colorBackground
          colorIcon
          longitude
          latitude
          ingameLongitude
          ingameLatitude
          ingameHeight
          timer
          imagePath
          category {
            id
            imagePath
          }
          map {
            urlId
          }
          imageList {
            id
            filePath
          }
        }
        ... on MapLayerCircle {
          id
          urlId
          title
          radius
          color
          pointLongitude
          pointLatitude
          measurements
          imagePath
          category {
            id
            imagePath
          }
        }
        ... on MapLayerPolyline {
          id
          urlId
          title
          thickness
          dash
          color
          points
          measurements
          imagePath
          category {
            id
            imagePath
          }
        }
        ... on MapLayerPolygon {
          id
          urlId
          title
          thickness
          borderOpacity
          fillOpacity
          dash
          borderColor
          fillColor
          points
          measurements
          imagePath
          category {
            id
            imagePath
          }
        }
        ... on MapLayerText {
          id
          urlId
          title
          color
          borderColor
          pointLongitude
          pointLatitude
          fontSize
          imagePath
          category {
            id
            imagePath
          }
        }
      }
    }
  }`
};

// ============================================================
// 工具函数
// ============================================================

function graphqlRequest(query, variables) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const options = {
      method: 'POST',
      headers: {
        ...CONFIG.headers,
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(CONFIG.graphqlUrl, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.errors) {
            reject(new Error(JSON.stringify(json.errors)));
          } else {
            resolve(json.data);
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// 主逻辑
// ============================================================

async function main() {
  console.log('📍 SCUM 地图 POI 数据抓取器');
  console.log('='.repeat(50));

  // 确保输出目录存在
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Step 1: 获取所有分类
  console.log('\n📂 步骤 1: 获取 POI 分类列表...');
  const categoryData = await graphqlRequest(QUERIES.categories, {
    mapTemplateId: CONFIG.mapTemplateId
  });

  const categories = categoryData.mapCategory.listForMapTemplate;
  console.log(`   找到 ${categories.length} 个分类`);

  // 保存分类数据
  const categoriesPath = path.join(CONFIG.outputDir, 'categories.json');
  fs.writeFileSync(categoriesPath, JSON.stringify(categories, null, 2));
  console.log(`   保存到: ${categoriesPath}`);

  // Step 2: 按分类获取标记点数据
  console.log('\n📍 步骤 2: 按分类获取 POI 标记点...');
  const allMarkers = {};
  let totalMarkers = 0;

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const catDir = path.join(CONFIG.outputDir, 'categories');
    if (!fs.existsSync(catDir)) fs.mkdirSync(catDir, { recursive: true });

    const catPath = path.join(catDir, `${cat.id}.json`);

    // 跳过已存在的文件
    if (fs.existsSync(catPath)) {
      const existing = JSON.parse(fs.readFileSync(catPath, 'utf-8'));
      console.log(`   ⏭️  [${i + 1}/${categories.length}] ${cat.name} (已存在, ${existing.length} 条)`);
      allMarkers[cat.id] = existing;
      totalMarkers += existing.length;
      continue;
    }

    try {
      const data = await graphqlRequest(QUERIES.markers, {
        categoryIdList: [cat.id],
        urlId: null,
        includeWithoutCategory: false
      });

      const markers = data.mapLayer.list || [];
      fs.writeFileSync(catPath, JSON.stringify(markers, null, 2));
      allMarkers[cat.id] = markers;
      totalMarkers += markers.length;

      console.log(`   ✅ [${i + 1}/${categories.length}] ${cat.name}: ${markers.length} 条`);

      // 避免请求过快
      await sleep(200);
    } catch (err) {
      console.error(`   ❌ [${i + 1}/${categories.length}] ${cat.name}: ${err.message}`);
    }
  }

  // Step 3: 生成汇总数据
  console.log('\n📊 步骤 3: 生成汇总数据...');

  const summary = {
    version: '1.0',
    mapTemplateId: CONFIG.mapTemplateId,
    scrapeDate: new Date().toISOString(),
    totalCategories: categories.length,
    totalMarkers,
    categories: categories.map(c => ({
      id: c.id,
      name: c.name,
      markerCount: (allMarkers[c.id] || []).length,
      appearance: c.appearance
    }))
  };

  const summaryPath = path.join(CONFIG.outputDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`   保存到: ${summaryPath}`);

  // 完成
  console.log('\n' + '='.repeat(50));
  console.log('✅ POI 数据抓取完成！');
  console.log(`   分类: ${categories.length} 个`);
  console.log(`   标记点: ${totalMarkers} 条`);
  console.log(`   目录: ${CONFIG.outputDir}`);
}

main().catch(err => {
  console.error('💥 致命错误:', err.message);
  process.exit(1);
});
