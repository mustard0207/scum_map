/**
 * SCUM Map Tile Downloader
 *
 * 从 scum-map.com 下载所有地图瓦片图片
 * 运行方式: node tools/tile-downloader.js
 *
 * 依赖: npm install node-fetch@2 (v2 支持 CommonJS)
 * 或者使用 Node.js 18+ 内置 fetch
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// ============================================================
// 配置
// ============================================================

const CONFIG = {
  // 瓦片 URL 模板（从 scum-map.com GraphQL API 获取）
  templateUrl: 'https://cdn.scum-map.com/tiles/scum/island/v50.0.2025.06.17-scum-1.0/regular/{z}/{x}_{y}.webp',

  // 缩放级别范围（nativeZoom: 2-6）
  minZoom: 2,
  maxZoom: 6,

  // 每个缩放级别的瓦片网格大小
  // zoom 2: 1x1, zoom 3: 2x2, zoom 4: 4x4, zoom 5: 8x8, zoom 6: 16x16
  getGridSize(zoom) {
    const size = Math.pow(2, zoom - 2);
    return { cols: size, rows: size };
  },

  // 输出目录
  outputDir: path.join(__dirname, '..', 'tiles'),

  // 并发下载数
  concurrency: 5,

  // 请求头（模拟浏览器）
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://scum-map.com/',
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
  }
};

// ============================================================
// 工具函数
// ============================================================

/**
 * 下载单个文件
 */
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 跳过已存在的文件
    if (fs.existsSync(destPath)) {
      const stat = fs.statSync(destPath);
      if (stat.size > 0) {
        console.log(`  ⏭️  跳过 (已存在): ${path.relative(CONFIG.outputDir, destPath)}`);
        resolve({ skipped: true });
        return;
      }
    }

    const file = fs.createWriteStream(destPath);

    https.get(url, { headers: CONFIG.headers }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        // 跟随重定向
        https.get(response.headers.location, { headers: CONFIG.headers }, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve({ size: redirectResponse.headers['content-length'] || 0 });
          });
        }).on('error', reject);
        return;
      }

      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ size: response.headers['content-length'] || 0 });
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

/**
 * 并发控制
 */
async function parallelLimit(tasks, limit) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < tasks.length) {
      const currentIndex = index++;
      try {
        results[currentIndex] = await tasks[currentIndex]();
      } catch (err) {
        results[currentIndex] = { error: err.message };
      }
    }
  }

  const workers = Array(Math.min(limit, tasks.length)).fill(null).map(() => worker());
  await Promise.all(workers);
  return results;
}

/**
 * 延迟
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================
// 主逻辑
// ============================================================

async function main() {
  console.log('🗺️  SCUM 地图瓦片下载器');
  console.log('='.repeat(50));
  console.log(`模板: ${CONFIG.templateUrl}`);
  console.log(`缩放级别: ${CONFIG.minZoom} - ${CONFIG.maxZoom}`);
  console.log(`输出目录: ${CONFIG.outputDir}`);
  console.log('');

  // 计算总任务数
  const tasks = [];
  for (let z = CONFIG.minZoom; z <= CONFIG.maxZoom; z++) {
    const { cols, rows } = CONFIG.getGridSize(z);
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        tasks.push({ z, x, y });
      }
    }
  }

  console.log(`📊 总计 ${tasks.length} 个瓦片待下载`);
  console.log('');

  // 创建下载任务
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  const downloadTasks = tasks.map(({ z, x, y }) => {
    return async () => {
      const url = CONFIG.templateUrl
        .replace('{z}', z)
        .replace('{x}', x)
        .replace('{y}', y);

      const destDir = path.join(CONFIG.outputDir, String(z));
      const destPath = path.join(destDir, `${x}_${y}.webp`);

      try {
        const result = await downloadFile(url, destPath);
        if (result.skipped) {
          skipped++;
        } else {
          downloaded++;
        }
        const total = downloaded + skipped + failed;
        if (total % 10 === 0 || total === tasks.length) {
          console.log(`  📥 进度: ${total}/${tasks.length} (下载: ${downloaded}, 跳过: ${skipped}, 失败: ${failed})`);
        }
        return result;
      } catch (err) {
        failed++;
        console.error(`  ❌ 失败: z${z}/${x}_${y} - ${err.message}`);
        return { error: err.message };
      }
    };
  });

  // 开始下载
  const startTime = Date.now();
  console.log('🚀 开始下载...');
  console.log('');

  await parallelLimit(downloadTasks, CONFIG.concurrency);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('');
  console.log('='.repeat(50));
  console.log('✅ 下载完成！');
  console.log(`   下载: ${downloaded} 个`);
  console.log(`   跳过: ${skipped} 个`);
  console.log(`   失败: ${failed} 个`);
  console.log(`   耗时: ${elapsed}s`);
  console.log(`   目录: ${CONFIG.outputDir}`);

  // 生成统计信息
  const stats = {
    version: 'v50.0.2025.06.17-scum-1.0',
    templateUrl: CONFIG.templateUrl,
    minZoom: CONFIG.minZoom,
    maxZoom: CONFIG.maxZoom,
    tileSize: 1280,
    format: 'webp',
    totalTiles: tasks.length,
    downloaded,
    skipped,
    failed,
    downloadDate: new Date().toISOString()
  };

  const statsPath = path.join(CONFIG.outputDir, 'stats.json');
  fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
  console.log(`   统计: ${statsPath}`);
}

main().catch(err => {
  console.error('💥 致命错误:', err.message);
  process.exit(1);
});
