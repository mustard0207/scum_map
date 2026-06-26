# 高清地图方案 — Z4 瓦片加载

## 问题

当前地图使用单张 1280×1280 JPG 底图（Z2 概览图），通过 CSS `transform: scale()` 缩放。
当用户放大到 2-4 倍时，图片被拉伸到 2560-5120 像素，严重模糊。

## 方案

引入 Z4 瓦片（4×4 网格，共 16 块，每块 640×640 JPG）。
根据当前缩放级别动态切换：Z2 用于概览，Z4 用于放大。

| 缩放范围 | 瓦片层级 | 渲染方式 | 清晰度 |
|---------|---------|---------|--------|
| scale < 1.5 | Z2 | 单张 1280×1280 图 | 基准 |
| scale ≥ 1.5 | Z4 | 4×4 网格，每块 640×640 | 2倍提升 |

**坐标系统不变**：逻辑坐标系始终是 1280×1280，Z4 每块覆盖 320×320 逻辑像素。
标记、网格、坐标转换等所有功能不受影响。

## 实现步骤

### 1. 瓦片资源转换

创建 `tools/convert_tiles_z4.py`：
- 读取 `tiles_mixed/4/{row}_{col}.webp`（640×640 webp）
- 转换为 JPG 格式
- 输出到 `miniprogram/packageMap/assets/tiles/4/{row}_{col}.jpg`

预计总大小：~1.5MB（16 张 JPG），放在 packageMap 分包内。

### 2. tile-map.js 改造

**新增常量**：
```javascript
const TILE_LEVELS = {
  2: { gridSize: 1, tileSize: 1280, srcPrefix: '/assets/tiles/2/' },
  4: { gridSize: 4, tileSize: 640,  srcPrefix: '/packageMap/assets/tiles/4/' }
  // srcPrefix 待实测确认，可能是 'assets/tiles/4/'（相对于分包根目录）
}
const Z4_SCALE_THRESHOLD = 1.5  // 超过此值切换到 Z4

// 注意：Z2 底图变量保持 fullMapSrc / fullMapSize 不变，不重命名为 baseMapSrc
```

**新增方法**：
- `_getActiveTileLevel(scale)` — 根据缩放返回当前瓦片层级（2 或 4）
- `_getVisibleTiles(tileLevel)` — 计算视口内可见瓦片列表
- `_computeTileData()` — 计算可见瓦片，返回 `{ visibleTiles }` 或 `{}`（无变化时）

**修改方法**：
- `_refreshOverlayAnim()` — 将瓦片计算合并到标记/网格的 setData 中（不增加额外 setData 次数）
- `_initMap()` — 初始化瓦片状态（visibleTiles=[], _tileIds=''）
- `resetView()` — **不要清空 `_tileIds`**，让 `_computeTileData` 自然检测到 level 4→2 的变化并返回 `{ visibleTiles: [] }`

**性能关键**：瓦片数据与标记/网格共享同一次 `setData` 调用，不额外增加桥接通信次数。

### 3. tile-map.wxml 改造

```xml
<view class="map-canvas" style="transform:translate(...) scale(...)">
  <!-- Z2 底图（始终渲染，作为兜底背景） -->
  <!-- 注意：不要加 lazy-load，CSS transform 下 lazy-load 判断失效 -->
  <image class="full-map" src="{{fullMapSrc}}" mode="scaleToFill"
    style="width:{{fullMapSize}}px;height:{{fullMapSize}}px;"
    binderror="onImageError" bindload="onImageLoad" />
  <!-- 高清瓦片网格（Z4 激活时叠在 Z2 上面） -->
  <image wx:for="{{visibleTiles}}" wx:key="id"
    class="map-tile"
    src="{{item.src}}"
    mode="scaleToFill"
    style="left:{{item.left}}px;top:{{item.top}}px;width:{{item.w}}px;height:{{item.h}}px;"
    binderror="onTileError" />
</view>
```

注意：
- Z2 去掉了 `wx:if`，始终渲染。Z4 瓦片通过 `position: absolute` 叠在 Z2 上方自然覆盖。
- **不要加 `lazy-load`**：WeChat 的 lazy-load 基于滚动视口判断，CSS transform 定位的元素不会被识别为"进入可视区"。
- 保持 `fullMapSrc` 变量名不变（与现有代码一致，不混入重命名）。

### 4. tile-map.wxss 改造

```css
.map-canvas {
  /* 新增 overflow: hidden，防止瓦片浮点溢出 */
  overflow: hidden;
}

.map-tile {
  display: block;
  position: absolute;
}
```

### 5. JS 新增：瓦片错误处理

```javascript
onTileError(e) {
  console.warn('瓦片加载失败:', e.currentTarget?.dataset?.id, e.detail?.errMsg)
}
```

### 6. 文档更新

更新 `docs/SCUM小助手-技术方案.md`：
- 将"瓦片加载"从二期目标移到已实现
- 更新瓦片相关章节

## 瓦片可见性计算

```javascript
/** 根据缩放级别返回当前应使用的瓦片层级 */
_getActiveTileLevel(scale) {
  return scale >= Z4_SCALE_THRESHOLD ? 4 : 2
}

/** 计算视口内可见瓦片列表 */
_getVisibleTiles(level) {
  const cfg = TILE_LEVELS[level]
  if (level === 2 || this.data.scale <= 0) return []  // Z2 无需瓦片网格；scale=0 防御

  const logicalSize = FULL_MAP_SIZE / cfg.gridSize  // Z4: 320
  const { offsetX, offsetY, scale } = this.data

  // 视口在逻辑坐标系中的范围
  const logicalLeft = -offsetX / scale
  const logicalTop = -offsetY / scale
  const logicalRight = (this._vw - offsetX) / scale
  const logicalBottom = (this._vh - offsetY) / scale

  // 可见瓦片的行列范围（用 ceil-1 避免边界多算一格）
  const colStart = Math.max(0, Math.floor(logicalLeft / logicalSize))
  const colEnd = Math.min(cfg.gridSize - 1, Math.ceil(logicalRight / logicalSize) - 1)
  const rowStart = Math.max(0, Math.floor(logicalTop / logicalSize))
  const rowEnd = Math.min(cfg.gridSize - 1, Math.ceil(logicalBottom / logicalSize) - 1)

  const tiles = []
  for (let r = rowStart; r <= rowEnd; r++) {
    for (let c = colStart; c <= colEnd; c++) {
      tiles.push({
        id: `tile_${level}_${r}_${c}`,
        src: `${cfg.srcPrefix}${r}_${c}.jpg`,
        left: c * logicalSize,
        top: r * logicalSize,
        w: logicalSize,
        h: logicalSize
      })
    }
  }
  return tiles
}

/** 计算瓦片数据（供 _refreshOverlayAnim 调用，不单独 setData） */
_computeTileData() {
  const newLevel = this._getActiveTileLevel(this.data.scale)
  const newTiles = this._getVisibleTiles(newLevel)

  // 比较 id 数组，仅在变化时返回新数据
  const newIds = newTiles.map(t => t.id).join(',')
  if (newIds === this._tileIds) return {}
  this._tileIds = newIds
  return { visibleTiles: newTiles }
}
```

## 瓦片更新时机

Z4 仅 16 块瓦片，计算量极小，无需防抖。瓦片计算合并到 `_refreshOverlayAnim` 中，与标记/网格共享同一次 setData。

| 场景 | 触发方式 |
|------|---------|
| 拖拽/惯性/缩放 | `_refreshOverlay()` → `_refreshOverlayAnim()` 中计算瓦片 |
| 双击缩放动画中 | `_refreshOverlayAnim()` 中计算瓦片（动画期间也执行） |
| 重置视图 | `resetView()` 不清空 `_tileIds`，`_computeTileData` 自然检测 level 4→2 变化 |

## 风险与应对

| 风险 | 应对 |
|------|------|
| JPG 转换后体积超预期 | 降低 JPEG quality 参数 |
| 瓦片切换闪烁 | Z2 始终作为背景层，Z4 加载后自然覆盖 |
| 某个瓦片加载失败 | binderror 回调，Z2 背景兜底（始终可见） |
| 分包内瓦片路径格式不对 | 先放 1 张瓦片实测 src 路径，确认后再批量转换 |
| Z4 激活时 Z2 浪费内存 (~6MB) | MVP 不处理；后续可优化：Z4 全部 load 后隐藏 Z2 |
