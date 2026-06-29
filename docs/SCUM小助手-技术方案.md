# SCUM游戏工具箱微信小程序 — 技术方案

> 版本：v1.0.0 (标记有效期系统+自定义标记筛选+标记上限100) | 更新日期：2026-06-29

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
| **本地数据持久化** | 用户标记和 POI 筛选状态自动保存到本地存储，下次打开自动恢复 |

### 1.3 二期目标
| 功能 | 说明 |
|------|------|
| ~~**标记类型分类**~~ | ~~自定义标记增加 `type` 字段~~ → **已在 v7.9 实现（房屋/载具/储物箱 3 种类型，emoji + 绿色背景）** |
| **分类筛选** | 按标记类型显示/隐藏标记点，底部栏增加筛选入口 |
| **POI 分类筛选** | 按分类（军事、城镇、载具等）显示/隐藏系统 POI 标记点 |
| ~~**瓦片加载**~~ | ~~分层加载不同缩放级别的瓦片~~ → **已在 v7.6 实现（Z2+Z3+Z4+Z6 分层加载）** |
| ~~**Z6 瓦片**~~ | ~~扩展 Z6（16×16）特写瓦片~~ → **已在 v7.6 实现（16×16 网格，scale ≥ 3.0 时激活，CDN 加载 + 本地缓存）** |

### 1.4 关键约束与破局方案
| 约束 | 解决方案（破局点） |
|------|------|
| 微信小程序包体限制 (主包2M/总包20M) | Z2 底图本地内置（455KB），Z4 瓦片走 jsDelivr CDN + 本地缓存 |
| 个人开发者零成本要求 | Z4 瓦片托管在 GitHub（免费），通过 jsDelivr CDN 加速（免费），本地缓存减少重复下载 |
| 纯前端的分享局限 | 放弃需要后台鉴权的"小程序码"生成功能，全面拥抱免费的"微信会话卡片（onShareAppMessage）"。 |
| movable-view 真机兼容性 | 弃用 movable-view，改用自定义 touch 手势实现所有交互 |

---

## 二、数据来源与压缩策略

### 2.1 地图数据
- **当前采用地图版本**：`v50.0.2025.06.17-scum-1.0` (跟随官方最新地图)
- **瓦片格式**：本地用 `.jpg`（真机兼容），网络用 `.webp`（需 `webp="true"` 属性）
- **当前使用**：Z2+Z3+Z4+Z6 分层加载
  - Z2 概览图（1280x1280，455KB JPG Q=80）— 主包本地内置，scale < 1.0 时使用
  - Z3 中景图（2×2 网格，每块 640x640 webp）— jsDelivr 网络加载 + 本地缓存，scale ≥ 1.0 时使用
  - Z4 近景图（4×4 网格，每块 640x640 webp）— jsDelivr 网络加载 + 本地缓存，scale ≥ 1.5 时使用
  - Z6 特写图（16×16 网格，每块 640x640 webp）— jsDelivr 网络加载 + 本地缓存，scale ≥ 3.0 时激活，Z4 作为兜底层
- **Z4 瓦片来源**：GitHub 仓库 `mustard0207/scum_map`，通过 jsDelivr CDN 加速
  - URL 模板：`https://cdn.jsdelivr.net/gh/mustard0207/scum_map@main/4/{x}_{y}.webp`
  - 本地缓存路径：`wx.env.USER_DATA_PATH/scum_tiles/4/{col}_{row}.webp`

### 2.2 图片格式说明
| 格式 | 模拟器 | 真机 | 说明 |
|------|--------|------|------|
| `.webp` | ✅ | ❌ | 真机不支持本地 webp 加载 |
| `.jpg` | ✅ | ✅ | 当前使用的格式 |
| `.png` | ✅ | ✅ | 备选格式，体积较大 |

### 2.3 瓦片分层加载（v7.6 已实现 Z2+Z3+Z4+Z6）
| 梯队 | 原始层级 | 网格 | 来源 | 物理尺寸 | 瓦片数 | 状态 |
|------|---------|------|------|---------|-------|------|
| **概览图** | Z2 (1x1) | 1×1 | 本地内置 JPG Q=80 | 1280x1280 | 1张 | ✅ |
| **过渡图** | Z3 (2x2) | 2×2 | jsDelivr 网络 webp | 1280x1280 | 4张 | ✅ |
| **中景图** | Z4 (4x4) | 4×4 | jsDelivr 网络 webp | 640x640 | 16张 | ✅ |
| **特写图** | Z6 (16x16) | 16×16 | jsDelivr 网络 webp | 640x640 | 256张 | ✅ |

**分层切换逻辑**：
- `scale < 1.0` → Z2 本地单图
- `1.0 ≤ scale < 1.5` → Z3 网络瓦片
- `1.5 ≤ scale < 3.0` → Z4 网络瓦片
- `scale ≥ 3.0` → Z6 网络瓦片（Z4 作为兜底层）
- 瓦片计算合并到 `_refreshOverlayAnim` 的 setData 中，不额外增加桥接调用次数

**缓存机制**：
- 首次加载：jsDelivr 网络下载 → 显示 → `wx.downloadFile` + `fs.saveFile` 保存到本地
- 再次加载：本地缓存直接读取，零网络请求
- 缓存路径：`wx.env.USER_DATA_PATH/scum_tiles/{level}/{col}_{row}.webp`

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
  - `pages/index`: 首页导航
  - `assets/tiles/`: 地图图片（主包中，确保真机可达）
- **地图分包 (packageMap)**
  - `pages/map`: 地图核心功能页
  - `components/tile-map`: 地图组件

### 4.2 路由配置 (app.json)
```json
{
  "pages": ["pages/index/index"],
  "subPackages": [
    {
      "root": "packageMap",
      "pages": ["pages/map/map"]
    }
  ]
}
```

---

## 五、自定义手势地图引擎 (WXS 架构)

### 5.1 核心渲染原理
抛弃 movable-view（真机兼容性问题），采用 **"WXS 响应式手势 + CSS transform"** 架构实现极致跟手性能：

- **物理容器**：外层 `<view>` 作为视口（`map-viewport`），内层 `<view>` 作为画布（`map-canvas`）
- **手势处理**：使用 WXS (微信小程序的高性能脚本层) 直接在视图层监听 `catchtouchstart`、`catchtouchmove`、`catchtouchend`，实现拖拽、惯性、双指缩放。这彻底切断了视图层和逻辑层之间的频繁通信延迟。
- **渲染方式**：WXS 内部通过 `setStyle({ transform: translate(x, y) scale(s) })` 控制画布位置和缩放。

### 5.2 状态同步与防冲突 (syncId 机制)
WXS 独立控制坐标时，如果 JS 侧发生 DOM 更新（如刷出新标记），JS 发送给 WXS 的状态数据可能包含过期的坐标，导致“惯性滑行被打断，画面闪回”。
- **解决方案**：引入 `syncId` 状态锁。
- 当 JS 只是想触发重绘而不改变坐标时，只更新 `wxsState.trigger`；
- 当 JS 主动跳转位置（如回到默认视角）时，递增并发送 `syncId`。
- WXS 端的 `propChange` 侦听到变化时，**必须且仅当 `syncId` 变化时**，才将 JS 的位置信息覆盖内部实时坐标。

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
> **v7.9 实现**：自定义标记支持 `type` 字段（`house`/`vehicle`/`box`），对应 emoji（🏠/🚗/📦）和绿色圆形背景。二进制编码版本字节升级为 `0x54`（含类型字段），`0x53` 为旧版无类型格式，解码器按版本自动区分。

### 7.2 标记渲染
- 标记放在 `map-viewport` 外面，避免被 `catchtouchstart` 拦截
- 标记位置通过 `geoToScreen()` 实时计算
- 标记尺寸固定（24px），不随地图缩放变化
- 使用 `bindtap` 绑定点击事件

### 7.3 信息窗口
- 点击标记后显示信息窗口（宽度 80%）
- 标题区：`◆` 图标 + 标记名称（无名时显示"自定义标记"）+ 副标题（POI 显示小类名，有类型显示类型名，否则显示"标记 #N"）+ 关闭按钮
- 坐标区：标签行（X/Y，灰色小字）+ 数值行（琥珀色大字等宽），两列对齐
- 类型选择器：仅自定义标记显示，3 个横排按钮（🏠 房屋 / 🚗 载具 / 📦 储物箱），选中高亮带绿色背景，再点取消
- 操作区：POI 标记 — `📋 复制` / `↗ 分享`；自定义标记 — `🗑 删除` / `📋 复制` / `↗ 分享`
- 分享按钮使用 `<button open-type="share">` 触发微信原生分享面板

### 7.4 底部操作栏
5 个按钮：输入 · 选点 · 分享 · 备份 · 筛选
- **输入**（⊕）：打开坐标输入弹窗，支持游戏原始格式和简单格式
- **选点**（◆）：将十字光标当前位置标记为选中点
- **分享**（↗）：触发微信原生分享面板
- **备份**（⇅）：弹出底部抽屉，提供"导入标记"和"导出标记"两个选项
- **筛选**（☰）：打开 POI 筛选面板，按分类显示/隐藏系统 POI 标记点

### 7.7 本地数据持久化
- 用户标记和 POI 筛选状态自动保存到 `wx.setStorageSync`（key: `scum_userMarkers` / `scum_activePoiCats`）
- 正常打开小程序自动恢复上次的标记和筛选
- 用户添加/删除/修改标记、切换筛选时防抖自动保存（300ms）
- 手动清除筛选或重置视图时同步更新存储

### 7.8 分享链接临时查看
- 从分享链接进入时标记为临时查看（`_isSharedView = true`），不自动保存
- 底部栏上方显示"📌 正在查看分享内容"提示条 + "保存到本地"按钮
- 点击保存弹出自定义确认弹窗（三按钮）：
  - **覆盖前备份**：从本地存储读取旧存档导出到剪贴板
  - **取消**：关闭弹窗
  - **确定**：将当前内容写入本地存储，替换旧存档
- 用户在分享页自行操作标记/筛选时自动接管为本地数据（清除 `_isSharedView`，启用自动保存）

### 7.5 回到全局视角
地图右下角浮动圆形按钮（⊙），半透明风格，点击重置地图到初始缩放和位置，**不清除标记**。上方有缩放拖拉条，可拖拉放大缩小。
与坐标面板（右下角）错开布局，z-index 50（与十字光标同级）。

### 7.6 标记数量限制
- 最多支持 100 个自定义标记（与 POI 标记独立计数，选点和坐标跳转入口均受限制）
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
  font-weight: normal;
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

## 九、安全区系统

### 9.1 概述

游戏内 4 个交易区（Trader Outposts）周围存在安全区，玩家在安全区内不可互相攻击。安全区以绿色半透明圆圈形式显示在地图上。

### 9.2 安全区数据

数据来源：scum-map.com 实测抓取 + 游戏服务器配置（ServerSettings.ini）交叉验证。

坐标系：虚幻引擎绝对坐标，**100 单位 = 1 米**。

```js
// tile-map.js — 安全区配置
const SAFE_ZONE_RADIUS = 46000  // 游戏坐标单位（460米 × 100单位/米）

const SAFE_ZONES = [
  { id: 'sz_a0', name: 'A0 安全区', lng: -610581, lat: -557027 },
  { id: 'sz_b4', name: 'B4 安全区', lng: 570708,  lat: -226174 },
  { id: 'sz_c2', name: 'C2 安全区', lng: -147082, lat: 278432 },
  { id: 'sz_z3', name: 'Z3 安全区', lng: 12563,   lat: -678195 }
]
```

| 安全区 | 游戏坐标 X | 游戏坐标 Y | 地图像素 X | 地图像素 Y | 区域 |
|--------|-----------|-----------|-----------|-----------|------|
| A0     | -610581   | -557027   | ≈1031     | ≈730      | 废土 |
| B4     | 570708    | -226174   | ≈38       | ≈593      | 沿海 |
| C2     | -147082   | 278432    | ≈660      | ≈281      | 雪山 |
| Z3     | 12563     | -678195   | ≈531      | ≈1004     | 岛屿 |

> ⚠️ **注意**：安全区圆心坐标 ≠ 前哨站建筑坐标。安全区中心可能与交易区建筑群有偏移，需以实测数据为准。

### 9.3 半径换算

```
游戏半径: 460米 × 100单位/米 = 46000 坐标单位
地图像素: 46000 / |(-904800) - 619200| × 1280 ≈ 38.6px（scale=1 时）
屏幕像素: 38.6 × scale（随缩放变化）
```

### 9.4 实现方式

安全区渲染与标记系统类似，由 WXS `updateStyles()` 统一管理屏幕定位。

**tile-map.js**：
- `_initSafeZones()` 在 `_initMap()` 中调用一次，将游戏坐标转换为地图像素坐标
- 存入 `data.safeZonesOnScreen`，包含 `px`（像素X）、`py`（像素Y）、`rpx`（半径像素）
- 半径计算使用 `Math.abs()` 避免坐标范围负值导致尺寸为负

**tile-map.wxml**：
- 安全区 `<view>` 元素在标记之前渲染，z-index 更低（10 vs 20）
- 通过 `data-px`/`data-py`/`data-rpx` 属性传递坐标数据给 WXS

**tile-map.wxss**：
- `box-sizing: border-box` 确保 width/height 包含 border，圆心精确对齐坐标点
- 绿色描边 `rgba(107, 191, 89, 0.6)` + 半透明绿底 `rgba(107, 191, 89, 0.12)`
- `pointer-events: none` 不阻挡手势操作

**gestures.wxs** — `updateStyles()` 中：
```js
// 安全区定位
var cx = parseFloat(ds.px) * s + ox;
var cy = parseFloat(ds.py) * s + oy;
var r = parseFloat(ds.rpx) * s;
zones[i].setStyle({
  left: (cx - r) + 'px',
  top: (cy - r) + 'px',
  width: (r * 2) + 'px',
  height: (r * 2) + 'px'
});
```

### 9.5 POI 筛选默认值

因安全区已有绿圈显示，`map.js` 中 `activePoiCats` 默认值从 `['80']` 改为 `[]`，不再默认勾选前哨站 POI 标记。

---

## 十、分享功能 (纯前端方案)

基于个人开发者零后端的限制，放弃小程序码，采用**微信群聊卡片**作为唯一且极简的分享途径。

### 9.1 技术实现
- 使用 `<button open-type="share">` 组件触发微信原生分享面板（分包中 `wx.shareAppMessage` 不可用）
- 通过页面级 `onShareAppMessage()` 回调提供分享数据
- 在 `onShow` 中调用 `wx.showShareMenu()` 启用右上角菜单转发

### 9.2 多标记分享
支持将地图上所有标记一次性分享给好友：
- **分享路径**：`/packageMap/pages/map/map?markers=lng1,lat1,name1|lng2,lat2,name2|...`
- **卡片标题**：`我给你分享了N个SCUM地图位置`（如有名称则追加 `：名称`）
- **标记上限**：最多 100 个标记（URL 长度限制约 2000 字符）

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

## 十一、项目目录结构

```
miniprogram/
├── app.js                       # 应用入口
├── app.json                     # 页面与分包配置
├── assets/
│   └── tiles/
│       └── 2/
│           └── 0_0.jpg          # Z2 概览图（455KB JPG Q=80，主包本地内置）
│
├── pages/                       # 主包：功能入口
│   └── index/
│
├── packageMap/                  # 地图分包（Z3/Z4/Z6 瓦片走网络加载+本地缓存）
│   ├── pages/
│   │   └── map/
│   │       ├── map.js           # 地图页面逻辑（含缩放拖拉条）
│   │       ├── map.wxml         # 地图页面模板
│   │       └── map.wxss         # 地图页面样式
│   │
│   └── components/
│       └── tile-map/
│           ├── tile-map.js      # 地图组件逻辑（Z2+Z3+Z4+Z6 分层加载）
│           ├── tile-map.wxml    # 地图组件模板
│           └── tile-map.wxss    # 地图组件样式
```

---

## 十二、关键实现细节

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

## 十三、性能优化检查

基于微信开发者工具性能扫描，逐项状态：

| # | 检查项 | 状态 | 说明 |
|---|--------|------|------|
| 1 | 代码包不超过 1.5M | ✅ | 主包约 500KB，packageMap 约 100KB |
| 2 | 引用插件不超过 200K | ✅ | 无插件引用 |
| 3 | 图片音频不超过 200K | ⚠️ | Z2 底图 455KB 超限；Z3/Z4/Z6 瓦片走网络加载 |
| 4 | 主包无仅被分包依赖的 JS | ✅ | 主包 JS 均为主包自用 |
| 5 | 主包无仅被分包依赖的组件 | ✅ | 主包无组件 |
| 6 | 无未使用的插件 | ✅ | 无插件 |
| 7 | 无未使用的组件 | ✅ | `tile-map` 组件已使用 |
| 8 | JS 压缩已开启 | ✅ | `minified: true` |
| 9 | WXML 压缩已开启 | ✅ | `minifyWXML: true` |
| 10 | WXSS 压缩已开启 | ✅ | `minifyWXSS: true` |
| 11 | 无依赖文件 | ⚠️ | 需在开发者工具中确认 |
| 12 | 组件懒注入已开启 | ✅ | `lazyCodeLoading: "requiredComponents"` |

---

## 十四、风险与应对
| 风险 | 应对方案 |
|------|---------|
| 图片格式兼容性 | 使用 JPG 格式，确保真机兼容 |
| 手势事件冲突 | 标记放在 map-viewport 外面，避免被 catchtouchstart 拦截；双击在 onTouchEnd 中检测，避免与拖拽冲突 |
| 地图滑出可视区域 | 右下角浮动"回到全局视角"按钮（⊙），一键重置缩放和位置 |
| 包体审核超限 | 主包约 500KB，packageMap 约 100KB，极度安全 |
| Z2 底图超过 200KB | `0_0.jpg`（455KB）超过微信 200KB 建议值，但可正常加载 |
| 分享 URL 超长 | 标记上限 100 个，单个标记约 20-25 字符，远低于 2000 字符限制 |
| 网格极端缩小不可读 | MIN_SCALE 动态等于适屏比例，用户无法缩到比初始状态更小 |
| 网格层阻挡手势 | grid-overlay 设置 `pointer-events: none`，所有触摸事件穿透到地图层 |
| 网格标签在复杂背景上不可读 | 白色大字 + 四方向黑色 text-shadow 描边，确保在任何地形上可读 |
| 地图被完全拖出视口 | PAN_MARGIN（50px）约束：地图边缘可超出视口但至少保留 50px 可见 |
| 视口尺寸计算不准 | 使用 `boundingClientRect` 获取组件真实渲染尺寸，避免手动减去状态栏/导航栏的误差 |
| Z3/Z4/Z6 瓦片加载失败 | Z2 底图始终渲染作为兜底；binderror 回调记录错误 |
| Z6 激活时 Z4 兜底层 | Z4 瓦片在 Z6 加载期间提供过渡清晰度 |
| jsDelivr 国内访问慢 | 首次加载可能较慢；本地缓存机制减少重复下载；可考虑备用 CDN |

---

## 十五、POI 分类筛选系统

### 14.1 数据来源

- **分类定义**：`category-map.js`（102 个分类，含 section/emoji/cnName）
- **点位数据**：按 section 合并为 12 个 JS 文件（每个 ≤162KB）
- 数据来源：scum-map.com GraphQL API

### 14.2 筛选面板

底部抽屉形式，两种模式：

**精简模式**（默认）：
- 3 个可展开大类：地堡、载具、辐射
- 3 个直选小类：警局、药店、加油站
- 底部"更多类目"切换到完整模式

**完整模式**：
- 12 个大类全部可展开
- 每个大类下显示所有小类 toggle
- 底部"收起"切换回精简模式

### 14.3 筛选规则

| 规则 | 说明 |
|------|------|
| 小类限额 | 最多同时开启 5 个 |
| 默认状态 | 无默认勾选（安全区已有绿圈显示） |
| 清除筛选 | 一键清除所有，包括默认前哨站 |
| 面板状态 | 关闭再打开保持之前的勾选 |

### 14.4 渲染限流

| 条件 | 行为 |
|------|------|
| scale < 6 | 每区每小类最多 10 个点（5×5 网格分区） |
| scale ≥ 6 | 显示全部可见 POI |
| 硬上限 | 单次渲染不超过 1000 个 |
| 用户标记 | 不受限流影响，始终显示 |

### 14.5 标记渲染

- **POI 标记**：使用 `category-map.js` 中的 emoji 图标（22px 文字）
- **用户标记**：默认使用 📌（图钉）
- 不同分类用不同 emoji 区分，无图片加载

### 14.6 数据加载

```
用户点击"筛选" → 展开大类 → _getSectionData(section)
  → require('../../data/poi/poi-{section}.js') → 缓存到 _sectionCache
  → 按 catId 筛选 → 限流 → 渲染到地图
```

### 14.7 emoji 兼容性

已排除 Unicode 13.0+ 的不兼容 emoji，使用广泛支持的 emoji：
- 不使用：🪖、🪵、🪨、🛖 等
- 安全使用：⭐、💀、🚗、💧、☢️、📌 等

---

## 十六、海量标记渲染与交互避坑指南（POI 限流）

为了保证在开启成百上千个地图点位时的性能，系统实施了以下极限优化策略：

### 8.1 基于“逻辑坐标”的自适应网格聚合
- **坑点**：基于屏幕坐标进行网格聚合，稍微拖动地图，标记就会因为屏幕坐标改变而重新分组，导致疯狂闪烁。
- **方案**：数据在筛选时一次性转换为**地图像素逻辑坐标 (0~1280)**，不受拖拽影响。
- **自适应格子**：`cellSize = 20px / scale`。缩小时格子变大（密集点合为1个代表）；放大到 `SCALE_THRESHOLD=3` 后自动关闭聚合。

### 8.2 DOM 渲染硬上限与视口裁剪
- 经过聚合后，仅筛选出当前屏幕视口（加入 `MARGIN` 半屏缓冲防边缘闪烁）内的标记。
- **200 个兜底上限**：最终送入 `setData` 的 DOM 节点数强制拦截在 `MAX_POI_RENDER` (200个) 以内，防止小程序内存泄漏和卡顿。
- **事件驱动**：在任何程序化缩放或位移（如返回全图、输入坐标、滑动右侧缩放条）结束时，**必须**主动调用 `_schedulePoiRefresh()`。

### 8.3 WXS 下的点击事件穿透代理
- **坑点**：`.map-viewport` 使用了 WXS 的 `catchtouchstart`，导致内部的标记 `.map-marker` 的 `tap` 事件无法触发。
- **方案**：采用**点反查策略**。WXS 根据触摸位移和时间差识别出"单击"后，将屏幕绝对坐标回传给 JS。JS 将坐标转为地图内部偏移，对当前可视标记做碰撞检测（半径 15px），命中则触发。

### 8.4 `catchtap=""` 空字符串无法阻止冒泡（弹窗误关闭）

> ⚠️ **高频踩坑点**：所有弹窗/对话框的容器必须用 `catchtap="noop"`，不能用 `catchtap=""`。

**坑点**：微信小程序中，`catchtap=""`（绑定到空字符串）**不能可靠阻止 tap 事件冒泡**。点击弹窗内部的输入框或按钮时，事件会穿透到外层 mask 的 `bindtap="closeDialog"`，导致弹窗意外关闭。

**案例**：坐标输入弹窗（v7.7 修复）和导入标记弹窗（v8.1 修复）均踩过此坑。

**错误写法**：
```xml
<!-- ❌ catchtap="" 不能阻止冒泡，点击内部元素会穿透关闭 -->
<view class="mask" bindtap="closeDialog">
  <view class="dialog" catchtap="">
    <input placeholder="输入内容" />
    <view bindtap="confirm">确定</view>
  </view>
</view>
```

**正确写法**：
```xml
<!-- ✅ catchtap="noop" 引用真实方法，可靠阻止冒泡 -->
<view class="mask" bindtap="closeDialog">
  <view class="dialog" catchtap="noop">
    <input placeholder="输入内容" />
    <view bindtap="confirm">确定</view>
  </view>
</view>
```

**JS 中定义空方法**：
```js
noop() {},  // 仅用于 catchtap 阻止冒泡，无实际逻辑
```

**原理**：`catchtap` 需要绑定到一个真实存在的方法引用才能生效。空字符串 `""` 在某些场景下被微信框架忽略，等同于未绑定。`"noop"` 指向页面中定义的空函数，框架能找到并执行（虽然无操作），从而正确拦截事件。
