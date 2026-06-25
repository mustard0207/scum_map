# SCUM游戏工具箱微信小程序 — 技术方案

> 版本：v7.2 (导入导出+二进制紧凑格式) | 更新日期：2026-06-25

---

## 一、项目概述

### 1.1 应用定位
**SCUM游戏工具箱** — 一个面向中国 SCUM 玩家社区的完全免费、零网络延迟的多功能工具箱微信小程序。

### 1.2 一期目标（MVP）
| 功能 | 说明 |
|------|------|
| **零延迟地图** | 地图数据全物理内置，纯单机秒开，即使在无网络环境下也能丝滑浏览 |
| **自定义手势** | 基于 touch 事件实现拖拽、惯性、双指缩放、双击缩放，避免 movable-view 真机兼容性问题 |
| **坐标系统** | 屏幕坐标 ↔ 地图像素坐标 ↔ 游戏坐标双向转换 |
| **坐标跳转** | 输入游戏坐标（支持原始格式）跳转到指定位置 |
| **多点标记** | 支持多个标记点，点击显示坐标信息，支持删除 |
| **区域网格系统** | 5×5 网格分隔（D4→Z0），DOM 叠加层实现，线条粗细不随缩放变化，标签始终可读 |
| **免费社交分享** | 依赖纯前端路径参数机制，通过微信会话卡片一键分享好友 |
| **标记导入导出** | 二进制紧凑格式（4 位小数精度），通过剪贴板备份/恢复标记 |

### 1.3 二期目标
| 功能 | 说明 |
|------|------|
| **标记类型分类** | 自定义标记增加 `type` 字段（如：基地、空投、载具、危险等），不同类型显示不同图标 |
| **分类筛选** | 按标记类型显示/隐藏标记点，底部栏增加筛选入口 |
| **POI 分类筛选** | 按分类（军事、城镇、载具等）显示/隐藏系统 POI 标记点 |
| **瓦片加载** | 分层加载不同缩放级别的瓦片，提升清晰度 |

### 1.4 关键约束与破局方案
| 约束 | 解决方案（破局点） |
|------|------|
| 微信小程序包体限制 (主包2M/总包20M) | 当前使用单张 JPG 底图（272KB），未来可扩展为瓦片分包 |
| 个人开发者零成本要求 | **完全抛弃外部图床（CDN/云存储）**，服务器成本降至绝对的 0 元/年。 |
| 纯前端的分享局限 | 放弃需要后台鉴权的"小程序码"生成功能，全面拥抱免费的"微信会话卡片（onShareAppMessage）"。 |
| movable-view 真机兼容性 | 弃用 movable-view，改用自定义 touch 手势实现所有交互 |

---

## 二、数据来源与压缩策略

### 2.1 地图数据
- **当前采用地图版本**：`v50.0.2025.06.17-scum-1.0` (跟随官方最新地图)
- **瓦片格式**：`.webp`（原始）→ `.jpg`（实际使用，解决真机兼容性问题）
- **当前使用**：Z2 概览图（1280x1280，272KB）

### 2.2 图片格式说明
| 格式 | 模拟器 | 真机 | 说明 |
|------|--------|------|------|
| `.webp` | ✅ | ❌ | 真机不支持本地 webp 加载 |
| `.jpg` | ✅ | ✅ | 当前使用的格式 |
| `.png` | ✅ | ✅ | 备选格式，体积较大 |

### 2.3 未来扩展：瓦片分包
| 梯队 | 原始层级 | 处理方式 | 物理尺寸 | 瓦片数 | 作用 |
|------|---------|---------|---------|-------|------|
| **概览图** | Z2 (1x1) | 无损保留 | 1280x1280 | 1张 | 保证用户打开地图第一眼的宏伟感和绝对清晰。 |
| **中景图** | Z4 (4x4) | 压缩 Q=60 | 640x640 | 16张 | 提供放大一倍的道路轮廓过渡。 |
| **特写图** | Z6 (16x16)| 压缩 Q=50 | 640x640 | 256张 | 极限放大，支持最高精度的打点和建筑识别。 |

---

## 三、技术架构

### 3.1 整体架构

```
┌────────────────────────────────────────────────────────────────┐
│                 SCUM游戏工具箱 (微信小程序端)                      │
│                                                                │
│  ┌─────────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ 自定义手势引擎    │  │ 坐标系统     │  │ 标记系统           │  │
│  │ (touch events)  │  │ (Geo Convert)│  │ (Markers)         │  │
│  └───────┬─────────┘  └──────┬───────┘  └─────┬─────────────┘  │
│          │                   │                │                │
│          ▼                   ▼                ▼                │
│    【拖拽/惯性/缩放/双击】    【屏幕↔游戏坐标】  【标记+信息窗+导入导出】│
└────────────────────────────────────────────────────────────────┘
```

架构核心思想：**"降维打击"**。能用自定义实现的绝不用有兼容性问题的原生组件，能存本地硬盘的绝不发网络请求。

---

## 四、页面设计与分包路由

### 4.1 应用导航结构
- **主包 (Main Package)**
  - `pages/index`: 首页导航
  - `pages/about`: 关于与版本说明
  - `assets/tiles/`: 地图图片（主包中，确保真机可达）
- **地图分包 (packageMap)**
  - `pages/map`: 地图核心功能页
  - `components/tile-map`: 地图组件

### 4.2 路由配置 (app.json)
```json
{
  "pages": ["pages/index/index", "pages/about/about"],
  "subPackages": [
    {
      "root": "packageMap",
      "pages": ["pages/map/map"]
    }
  ]
}
```

---

## 五、自定义手势地图引擎

### 5.1 核心渲染原理
抛弃 movable-view（真机兼容性问题），采用 **"自定义 touch 手势 + CSS transform"** 架构：

- **物理容器**：外层 `<view>` 作为视口（`map-viewport`），内层 `<view>` 作为画布（`map-canvas`）
- **手势处理**：监听 `catchtouchstart`、`catchtouchmove`、`catchtouchend` 实现拖拽、惯性、缩放
- **渲染方式**：通过 CSS `transform: translate(x, y) scale(s)` 控制画布位置和缩放

### 5.2 手势实现

**拖拽**：
```javascript
onTouchMove(e) {
  const dx = touches[0].clientX - this._lastX
  const dy = touches[0].clientY - this._lastY
  this.setData({
    offsetX: this.data.offsetX + dx,
    offsetY: this.data.offsetY + dy
  })
}
```

**惯性**：
```javascript
_startInertia() {
  const animate = () => {
    this._velX *= INERTIA_FRICTION  // 0.95
    this._velY *= INERTIA_FRICTION
    this.setData({
      offsetX: this.data.offsetX + this._velX * 16,
      offsetY: this.data.offsetY + this._velY * 16
    })
    this._inertiaTimer = setTimeout(animate, 16)
  }
}
```

**双指缩放（以双指中心为锚点）**：
```javascript
// 公式：newOffset = pinchCenter - (pinchCenter - oldOffset) * newScale / oldScale
const newOffsetX = cx - (cx - ox0) * s1 / s0
const newOffsetY = cy - (cy - oy0) * s1 / s0
```

**双击缩放（以点击位置为锚点）**：
```javascript
// 在 onTouchEnd 中检测点击：手指总移动距离 < 10px 视为点击
// 不依赖 _isDrag 标记（手机触摸总有微小位移，会导致 _isDrag 误判为拖拽）
// 双击判定：两次点击间隔 < 300ms，位置偏移 < 30px
// 当前 >= 2x → 回到 1x；当前 < 2x → 放大到 2x
const targetScale = curScale >= 2 ? 1 : Math.min(MAX_SCALE, curScale * 2)
// 使用 ease-out cubic 动画（200ms）平滑过渡
```
- 在 `onTouchEnd` 中通过 `changedTouches` 获取松手位置，与 `_touchStartX/Y` 比较判断是否为点击
- 不使用 `bindtap`（`catchtouchstart` 会影响 `bindtap` 的触发可靠性）
- 不使用 `_isDrag` 判定（手机触摸总有皮肤形变产生的微小位移，`onTouchMove` 会将 `_isDrag` 设为 `true`，导致点击检测被跳过）
- 动画期间跳过标记位置刷新，由动画循环统一更新

**鼠标滚轮缩放**：微信小程序标准 WXML 事件不包含 `bindmousewheel`，普通 `<view>` 不支持此事件，暂不实现。

### 5.3 离线秒开机制
地图图片（JPG）放在主包 `assets/` 目录中，随小程序直接安装到用户手机闪存。
加载图片时**不会产生任何一次 HTTP 请求**，不受弱网环境干扰。

---

## 六、坐标系统

### 6.1 坐标系定义

**游戏坐标范围**（来自 app.js globalData）：
```javascript
geoBoundingBox: {
  latitudeTop: 619199.938,     // 地图顶部（纬度）
  latitudeBottom: -904800,     // 地图底部（纬度）
  longitudeLeft: 619200,       // 地图左侧（经度）
  longitudeRight: -904800      // 地图右侧（经度）
}
```

### 6.2 坐标转换公式

**屏幕坐标 → 地图像素坐标**：
```javascript
pixelX = (screenX - offsetX) / scale
pixelY = (screenY - offsetY) / scale
```

**地图像素坐标 → 游戏坐标**：
```javascript
geoLng = longitudeLeft + (pixelX / 1280) * (longitudeRight - longitudeLeft)
geoLat = latitudeTop + (pixelY / 1280) * (latitudeBottom - latitudeTop)
```

**游戏坐标 → 地图像素坐标**：
```javascript
pixelX = (geoLng - longitudeLeft) / (longitudeRight - longitudeLeft) * 1280
pixelY = (geoLat - latitudeTop) / (latitudeBottom - latitudeTop) * 1280
```

### 6.3 坐标输入格式

支持两种格式：

**游戏原始格式**：
```
{X=19079.908 Y=-687946.000 Z=873.744|P=345.041779 Y=359.998291 R=0.000000}
```

**简单格式**：
```
19079.908, -687946.000
19079.908 -687946.000
```

---

## 七、标记系统

### 7.1 标记数据结构
```javascript
{
  id: 'user_1234567890',  // 唯一标识
  lng: 19079.908,         // 游戏经度
  lat: -687946.000,       // 游戏纬度
  name: ''                // 标记名称（可选）
  // type: 'base'         // 二期：标记类型（base/airdrop/vehicle/danger 等）
}
```
> **二期扩展**：增加 `type` 字段用于标记分类，不同类型在地图上显示不同图标。导入导出的二进制格式已预留版本标识（首字节 `S`），后续可通过版本号扩展字段。

### 7.2 标记渲染
- 标记放在 `map-viewport` 外面，避免被 `catchtouchstart` 拦截
- 标记位置通过 `geoToScreen()` 实时计算
- 标记尺寸固定（24px），不随地图缩放变化
- 使用 `bindtap` 绑定点击事件

### 7.3 信息窗口
- 点击标记后显示信息窗口
- 显示标记名称、经度、纬度
- 支持删除、复制坐标、分享操作
- 分享按钮使用 `<button open-type="share">` 触发微信原生分享面板

### 7.5 底部操作栏
5 个按钮：输入 · 选点 · 分享 · 导入 · 导出
- **输入**：打开坐标输入弹窗，支持游戏原始格式和简单格式
- **选点**：将十字光标当前位置标记为选中点
- **分享**：触发微信原生分享面板
- **导入**：从剪贴板粘贴标记代码（`SCUM#` 前缀）恢复标记
- **导出**：将所有标记编码为紧凑代码复制到剪贴板

### 7.4 标记数量限制
- 最多支持 50 个标记（选点和坐标跳转入口均受限制）
- 接收分享链接的标记不受此限制

---

## 八、区域网格系统

### 8.1 网格规格

SCUM 地图划分为 **5×5** 的区域网格，方便玩家快速定位。

**行标签**（从上到下）：D → C → B → A → Z
**列标签**（从左到右）：4 → 3 → 2 → 1 → 0

```
     4      3      2      1      0
  ┌──────┬──────┬──────┬──────┬──────┐
D │  D4  │  D3  │  D2  │  D1  │  D0  │
  ├──────┼──────┼──────┼──────┼──────┤
C │  C4  │  C3  │  C2  │  C1  │  C0  │
  ├──────┼──────┼──────┼──────┼──────┤
B │  B4  │  B3  │  B2  │  B1  │  B0  │
  ├──────┼──────┼──────┼──────┼──────┤
A │  A4  │  A3  │  A2  │  A1  │  A0  │
  ├──────┼──────┼──────┼──────┼──────┤
Z │  Z4  │  Z3  │  Z2  │  Z1  │  Z0  │
  └──────┴──────┴──────┴──────┴──────┘
```

- 逻辑坐标系：1280×1280（固定，与地图分辨率一致）
- 每格尺寸：256×256 逻辑像素
- 网格线：仅内部分隔线（4H + 4V = 8 条），不含四周边框

### 8.2 渲染方案：DOM 叠加层

网格采用 **独立 DOM 叠加层** 渲染，不参与地图的 CSS `scale` 变换，确保线条粗细和标签大小始终固定。

**层叠顺序**：
```
map-viewport
  ├─ map-canvas          ← 地图（CSS transform: translate + scale）
  ├─ grid-overlay        ← 网格（无 transform，pointer-events: none）
  │    ├─ 横线 ×4
  │    ├─ 竖线 ×4
  │    └─ 标签 ×25
  └─ markers / info-window ← 标记与信息窗口（最顶层）
```

**关键属性**：
- `position: absolute`，覆盖整个视口区域
- `pointer-events: none`，所有触摸事件穿透到地图层
- `overflow: hidden`，裁剪超出视口的网格线和标签

### 8.3 坐标计算

网格线和标签的屏幕位置根据当前地图的 `offsetX`、`offsetY`、`scale` 实时计算：

```javascript
// 逻辑坐标 → 屏幕坐标（与 geoToScreen 公式一致）
screenPos = logicalPos × scale + offset

// 横线 i（i = 1..4）的屏幕 Y 坐标
lineY = i × 256 × scale + offsetY

// 竖线 j（j = 1..4）的屏幕 X 坐标
lineX = j × 256 × scale + offsetX

// 标签 (行 r, 列 c) 的屏幕位置（含 8px 偏移）
labelX = c × 256 × scale + offsetX + 8
labelY = r × 256 × scale + offsetY + 8
```

网格数据随地图 `offsetX`/`offsetY`/`scale` 变化实时更新，触发时机包括：
- 拖拽移动（`onTouchMove`）
- 惯性动画（`_startInertia`）
- 双指缩放（`onTouchMove` 双指分支）
- 双击缩放动画（`_animateZoomTo`）
- 视图重置（`resetView`，内部方法）

### 8.4 标签样式

```css
.grid-label {
  position: absolute;
  font-size: 16px;
  font-weight: bold;
  color: rgba(255, 255, 255, 1);
  pointer-events: none;
  /* 四方向黑色描边，确保在任何背景上可读 */
  text-shadow:
    -1px 0 0 rgba(0, 0, 0, 0.8),
     1px 0 0 rgba(0, 0, 0, 0.8),
    0 -1px 0 rgba(0, 0, 0, 0.8),
    0  1px 0 rgba(0, 0, 0, 0.8);
  white-space: nowrap;
}
```

### 8.5 网格线样式与裁剪

网格线通过 JS 动态计算 `left/right/top/bottom`，裁剪到地图可见区域，不超出地图边界。

```css
.grid-line {
  position: absolute;
  background: rgba(255, 255, 255, 0.2);
}

.grid-line-h {
  height: 1.5px;           /* 固定屏幕像素，不随缩放变化 */
  /* left/right 由 JS 动态设置，裁剪到地图可见区域 */
}

.grid-line-v {
  width: 1.5px;
  /* top/bottom 由 JS 动态设置，裁剪到地图可见区域 */
}
```

裁剪计算：
```javascript
const mapLeft = Math.max(0, offsetX)
const mapRight = Math.min(viewportWidth, FULL_MAP_SIZE * scale + offsetX)
const mapTop = Math.max(0, offsetY)
const mapBottom = Math.min(viewportHeight, FULL_MAP_SIZE * scale + offsetY)

// 横线：left=mapLeft, right=viewportWidth-mapRight
// 竖线：top=mapTop, bottom=viewportHeight-mapBottom
```

### 8.6 缩放限制与边缘约束

**动态最小缩放**：`MIN_SCALE` 不固定，而是等于初始适屏比例（让地图完全显示在屏幕中的缩放值）。用户放大后仍能缩回全图状态。

```javascript
// attached 中计算
const scale = Math.min(vw / FULL_MAP_SIZE, vh / FULL_MAP_SIZE)
MIN_SCALE = scale  // 动态设置
const MAX_SCALE = 4
```

**边缘约束（PAN_MARGIN）**：限制地图不被完全拖出视口，至少保留 50px 在视口内。

```javascript
const PAN_MARGIN = 50

// 左边缘：地图右侧至少露出 PAN_MARGIN
if (offsetX + mapW < PAN_MARGIN) offsetX = PAN_MARGIN - mapW
// 右边缘：地图左侧至少露出 PAN_MARGIN
if (offsetX > vw - PAN_MARGIN) offsetX = vw - PAN_MARGIN
// 上边缘：地图底部至少露出 PAN_MARGIN
if (offsetY + mapH < PAN_MARGIN) offsetY = PAN_MARGIN - mapH
// 下边缘：地图顶部至少露出 PAN_MARGIN
if (offsetY > vh - PAN_MARGIN) offsetY = vh - PAN_MARGIN
```

**视口尺寸获取**：使用 `boundingClientRect` 获取组件真实渲染尺寸，而非手动计算（需减去状态栏、导航栏、底栏）。

```javascript
setTimeout(() => {
  wx.createSelectorQuery().in(this)
    .select('.map-viewport').boundingClientRect(rect => {
      this._vw = rect.width
      this._vh = rect.height
      this._initMap()
    }).exec()
}, 50)
```

### 8.7 后期瓦片适配

当二期引入瓦片分层加载后，地图实际物理尺寸会变大（如 Z6 为 5120×5120）。
网格始终基于 **固定逻辑坐标系 1280×1280** 定义，通过 `scale` 换算到屏幕像素：

| 瓦片层级 | 物理尺寸 | 逻辑尺寸 | scale | 每格屏幕像素（MIN_SCALE=0.5） |
|---------|---------|---------|-------|---------------------------|
| Z2 单图 | 1280px | 1280 | 1.0 | 128px |
| Z4 瓦片 | 2560px | 1280 | 2.0 | 256px |
| Z6 瓦片 | 5120px | 1280 | 4.0 | 512px |

---

## 九、分享功能 (纯前端方案)

基于个人开发者零后端的限制，放弃小程序码，采用**微信群聊卡片**作为唯一且极简的分享途径。

### 9.1 技术实现
- 使用 `<button open-type="share">` 组件触发微信原生分享面板（分包中 `wx.shareAppMessage` 不可用）
- 通过页面级 `onShareAppMessage()` 回调提供分享数据
- 在 `onShow` 中调用 `wx.showShareMenu()` 启用右上角菜单转发

### 9.2 多标记分享
支持将地图上所有标记一次性分享给好友：
- **分享路径**：`/packageMap/pages/map/map?markers=lng1,lat1,name1|lng2,lat2,name2|...`
- **卡片标题**：`我给你分享了N个SCUM地图位置`（如有名称则追加 `：名称`）
- **标记上限**：最多 50 个标记（URL 长度限制约 2000 字符）

### 9.3 接收者定位
接收者在微信群点击卡片，小程序直接启动并解析参数：
```javascript
onLoad(options) {
  if (options.markers) {
    // 新格式：多标记 markers=lng1,lat1,name1|lng2,lat2,name2|...
    const sharedMarkers = options.markers.split('|').map((item, i) => {
      const parts = item.split(',')
      return { id: 'shared_' + Date.now() + '_' + i, lng: parseFloat(parts[0]), lat: parseFloat(parts[1]), name: decodeURIComponent(parts[2] || '') }
    })
    this.setData({ markers: sharedMarkers })
    // 跳转到最后一个标记位置
  } else if (options.x && options.y) {
    // 旧格式兼容：单个标记 x=lng&y=lat&name=xxx
  }
}
```

### 9.4 兼容性
- 保留旧格式 `x=&y=&name=` 的解析，之前分享的链接仍可正常打开
- 分享入口：信息窗口内的"↗ 分享"按钮 + 底部操作栏的"分享"按钮

### 9.5 标记导入导出（剪贴板）
支持将自定义标记导出为紧凑代码（复制到剪贴板），也可从剪贴板导入代码恢复标记。

**二进制紧凑格式**：
- 前缀：`SCUM#`
- 载荷：Base64 编码的二进制数据
- 首字节 `0x53`（`'S'`）标识新格式，后续可按版本号扩展
- 坐标精度：4 位小数（×10000，有符号 40 位整数，5 字节/坐标）
- 第 1 个标记存绝对坐标（10 字节），后续标记存与前一个的偏移量（zigzag + varint，通常 2~4 字节/坐标对）
- 名字：varint 长度前缀 + UTF-8 字节

**预估长度**：
| 标记数 | 密集区域 | 分散区域 |
|--------|----------|----------|
| 10 | ~80 字符 | ~220 字符 |
| 30 | ~208 字符 | ~640 字符 |
| 50 | ~340 字符 | ~1060 字符 |

**兼容性**：解码时自动检测首字节，新二进制格式走 `_decodeBinaryMarkers`，旧文本格式走 `_decodeTextMarkers`。

**二期扩展**：标记类型 `type` 字段可在二进制格式的版本 2 中追加（1 字节枚举值），不影响旧版本解码。

---

## 十、项目目录结构

```
miniprogram/
├── app.js                       # 应用入口
├── app.json                     # 页面与分包配置
├── assets/
│   └── tiles/
│       └── 2/
│           └── 0_0.jpg          # Z2 概览图（272KB，主包中）
│
├── pages/                       # 主包：功能入口
│   ├── index/
│   └── about/
│
├── packageMap/                  # 地图分包
│   ├── pages/
│   │   └── map/
│   │       ├── map.js           # 地图页面逻辑
│   │       ├── map.wxml         # 地图页面模板
│   │       └── map.wxss         # 地图页面样式
│   │
│   └── components/
│       └── tile-map/
│           ├── tile-map.js      # 地图组件逻辑
│           ├── tile-map.wxml    # 地图组件模板
│           └── tile-map.wxss    # 地图组件样式
```

---

## 十一、关键实现细节

### 11.1 图片加载路径
真机环境下，图片路径必须使用绝对路径，且放在主包中：
```javascript
const FULL_MAP_SRC = '/assets/tiles/2/0_0.jpg'
```

### 11.2 手势事件绑定
地图手势绑定在 `map-viewport` 上，标记放在 `map-viewport` 外面：
```xml
<!-- 触摸手势（含双击检测） -->
<view class="map-viewport"
  catchtouchstart="onTouchStart"
  catchtouchmove="onTouchMove"
  catchtouchend="onTouchEnd">
  <view class="map-canvas">...</view>
</view>

<!-- 标记放在外面，使用 bindtap -->
<view class="map-marker" bindtap="onMarkerTap">...</view>
```

### 11.3 缩放锚点
所有缩放操作均以操作点为锚点（非屏幕中心），统一公式：
```javascript
newOffset = anchor - (anchor - oldOffset) * newScale / oldScale
```
- **双指缩放**：anchor = 双指中心点
- **双击缩放**：anchor = 双击位置

### 11.4 初始缩放比例与视口尺寸
让地图完全显示在屏幕中，`MIN_SCALE` 动态等于此值：
```javascript
const scale = Math.min(vw / FULL_MAP_SIZE, vh / FULL_MAP_SIZE)
MIN_SCALE = scale
```

视口尺寸通过 `boundingClientRect` 获取（而非手动计算），避免状态栏/导航栏高度误差：
```javascript
wx.createSelectorQuery().in(this)
  .select('.map-viewport').boundingClientRect(rect => {
    this._vw = rect.width
    this._vh = rect.height
  }).exec()
```

---

## 十二、风险与应对
| 风险 | 应对方案 |
|------|---------|
| 图片格式兼容性 | 使用 JPG 格式，确保真机兼容 |
| 手势事件冲突 | 标记放在 map-viewport 外面，避免被 catchtouchstart 拦截；双击在 onTouchEnd 中检测，避免与拖拽冲突 |
| 地图滑出可视区域 | 双击缩放回初始比例，或重新进入页面 |
| 包体审核超限 | 当前总包约 1MB，极度安全 |
| 分享 URL 超长 | 标记上限 50 个，单个标记约 20-25 字符，远低于 2000 字符限制 |
| 网格极端缩小不可读 | MIN_SCALE 动态等于适屏比例，用户无法缩到比初始状态更小 |
| 网格层阻挡手势 | grid-overlay 设置 `pointer-events: none`，所有触摸事件穿透到地图层 |
| 网格标签在复杂背景上不可读 | 白色大字 + 四方向黑色 text-shadow 描边，确保在任何地形上可读 |
| 地图被完全拖出视口 | PAN_MARGIN（50px）约束：地图边缘可超出视口但至少保留 50px 可见 |
| 视口尺寸计算不准 | 使用 `boundingClientRect` 获取组件真实渲染尺寸，避免手动减去状态栏/导航栏的误差 |
