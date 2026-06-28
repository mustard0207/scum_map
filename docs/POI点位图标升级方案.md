# SCUM 地图工具 - POI 点位图标"水滴化"升级方案

本方案通过纯 CSS 技巧将当前的圆形 POI 图标升级为底部带尖的"水滴/大头针"形态，解决坐标锚点不清晰、且 emoji 容易与地图底色混淆的问题。同时优化了区域网格标签的视觉效果。

---

## 一、POI 水滴化

### 1.1 样式变更 (`tile-map.wxss`)

不改变原有 `tile-map.wxml` 结构，仅通过 CSS 实现水滴形态。

- **`.map-marker`（所有标记）**：
  - `transform: translate(-12px, -29px) rotate(-45deg)` — 旋转 -45°，通过精确 translate 将左下角尖角定位到 `left/top` 坐标点
  - 不依赖 `transform-origin`，使用默认值 `50% 50%`，通过数学计算得出偏移量
  - `border-radius: 50% 50% 50% 0` — 左下角为尖角，生成水滴轮廓
  - 默认深色半透明背景 + 白色描边 2px + 深色阴影
  - 尺寸：`width: 20px; height: 20px`（边框盒 24×24px）

- **`.marker-emoji`（emoji 文本）**：
  - `transform: rotate(45deg)` 反向扶正，抵消父容器的 -45° 旋转
  - 字号 `13px`

- **`.marker-typed`（有底色的标记）**：
  - 覆盖默认背景为类型颜色（如 `#6BBF59`）

### 1.2 碰撞检测 (`tile-map.js` — `onTapAtPoint`)

水滴锚点在底部尖端（`my`），图标向上延伸约 34px。

```js
const HIT_RADIUS_X = 15  // X 轴中心对称容差
const HIT_TOP = 28       // Y 轴向上覆盖水滴主体
// 判定: Math.abs(vpX - mx) < 15 && vpY >= my - 28 && vpY <= my
```

### 1.3 transform 定位数学推导

不使用 `transform-origin`（小程序对其解析存在不可靠性），在默认 `transform-origin: 50% 50%` 下精确计算：

```
边框盒: 24×24px
默认 transform-origin: (12, 12)
尖角位置（左下角）: (0, 24)

rotate(-45deg) 围绕 (12,12) 旋转后：
  尖角向量 (-12, +12) → 旋转后 (0, 16.97)
  绝对位置: (12, 28.97)

translate(-12, -29) 将尖角归位到 (0, 0) ≈ left/top 坐标点
```

---

## 二、区域网格标签优化

### 2.1 变更内容

- **偏移量**：`GRID_LABEL_OFFSET` 从 `8px` 改为 `4px`，标签更贴近格子左上角
- **字重**：`font-weight` 从 `bold` 改为 `normal`，视觉更轻盈
- **字号**：保持 `16px` 不变

---

## 三、涉及文件清单

| 文件 | 变更内容 |
|------|---------|
| `tile-map.js` | 碰撞检测参数、`GRID_LABEL_OFFSET` |
| `tile-map.wxss` | `.map-marker` 水滴样式、`.marker-emoji` 反向旋转、`.marker-typed` 背景色、`.grid-label` 字重 |
| `gestures.wxs` | 无变更（标记定位逻辑不变） |
