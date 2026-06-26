# POI数据处理方案

> 版本：v3.0 | 更新日期：2026-06-26

---

## 一、数据来源

### 1.1 原始数据

从 scum-map.com 网站 GraphQL API 获取，包含地图上所有 POI（兴趣点）标记。

**数据位置**：`点位数据/` 文件夹

### 1.2 数据文件结构

```
点位数据/
├── category-map.js          ← 分类映射表（102个分类，含 section/emoji/cnName）
├── 分类/                     ← 每个分类一个 JS 文件（102个）
│   ├── 1-Bunkers.js         ← [id, catId, lng, lat, h] 数组格式
│   ├── 20-Vehicle spawns.js
│   ├── 80-Outposts.js
│   └── ...
└── poi-*.js                  ← 按 section 合并后的数据（12个，由脚本生成）
    ├── poi-Bunkers.js
    ├── poi-Buildings.js
    ├── poi-Crops.js
    └── ...
```

### 1.3 小程序数据目录

```
miniprogram/packageMap/data/
├── category-map.js           ← 直接复制自 点位数据/category-map.js
└── poi/
    ├── poi-Bunkers.js        ← 由 merge-poi-data.js 合并生成
    ├── poi-Buildings.js
    ├── poi-Crops.js
    └── ...（共12个 section 文件）
```

---

## 二、分类映射表 (category-map.js)

### 2.1 数据格式

```javascript
module.exports = {
  "80": {
    "id": 80,
    "name": "Outposts",
    "section": "Points of interest",
    "emoji": "⭐",
    "cnName": "前哨站"
  },
  // ... 共102个分类
};
```

### 2.2 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | number | 分类唯一标识符 |
| `name` | string | 英文分类名称 |
| `section` | string | 所属大类（用于筛选分组） |
| `emoji` | string | 显示用的 emoji 图标 |
| `cnName` | string | 中文分类名称 |

### 2.3 Section 大类分组（12个）

| Section | 中文名 | 分类数 | 点位数 |
|---------|--------|--------|--------|
| Buildings | 建筑 | 24 | 1161 |
| Crops | 农作物 | 16 | 2441 |
| Vehicles | 载具 | 7 | 1969 |
| 无分组 | 未分类 | 15 | 769 |
| Water sources | 水源 | 5 | 352 |
| Construction materials | 建筑材料 | 5 | 301 |
| Points of interest | 兴趣点 | 6 | 169 |
| Quests | 任务 | 4 | 131 |
| Loot containers | 战利品容器 | 2 | 130 |
| Bunkers | 地堡 | 6 | 99 |
| Radiation | 辐射 | 4 | 59 |
| Outposts | 前哨站 | 8 | 33 |

---

## 三、POI 数据格式

### 3.1 数组格式

每个分类文件导出一个数组，每个元素为一个 POI：

```javascript
// 分类/20-Vehicle spawns.js
module.exports = [
  [id, catId, igLng, igLat, igH],
  [id, catId, igLng, igLat, igH],
  ...
];
```

| 位置 | 字段 | 类型 | 说明 |
|------|------|------|------|
| 0 | id | number | POI 唯一标识符 |
| 1 | catId | number | 分类 ID（对应 category-map.js） |
| 2 | igLng | number | 游戏内经度（-904800 ~ 619200） |
| 3 | igLat | number | 游戏内纬度（-904800 ~ 619200） |
| 4 | igH | number | 游戏内高度 |

### 3.2 合并后格式（section 文件）

`merge-poi-data.js` 将同一 section 的所有分类合并为一个文件，格式转为对象：

```javascript
// poi/poi-Bunkers.js
module.exports = [
  { id: 475463, cat: 1, lng: -871793.312, lat: 596998.5, h: 62987.523 },
  ...
];
```

---

## 四、数据处理流程

### 4.1 合并脚本

```bash
node tools/merge-poi-data.js
```

**功能**：将 `点位数据/分类/` 下的 102 个分类文件按 section 合并为 12 个文件，输出到 `miniprogram/packageMap/data/poi/`。

**何时运行**：从 scum-map.com 更新分类数据后运行一次。

### 4.2 数据更新流程

1. 从 scum-map.com 获取新数据（分类 + 点位）
2. 更新 `点位数据/category-map.js`（如有新分类或 emoji 调整）
3. 更新 `点位数据/分类/*.js`（点位数据文件）
4. 运行 `node tools/merge-poi-data.js` 重新合并
5. 复制 `category-map.js` 到 `miniprogram/packageMap/data/`

---

## 五、小程序中的使用

### 5.1 数据加载

```javascript
// 分类配置（直接 require）
const catMap = require('../../data/category-map.js')

// Section 数据（按需加载）
const sectionData = require('../../data/poi/poi-Bunkers.js')
```

### 5.2 数据流转

```
catMap → 构建 poiCategories 数组（WXML 遍历）
       → 构建 CAT_EMOJI / CAT_CN / CAT_SECTION 查找表
       → 构建 sectionMap（section → subs 映射）

section 数据 → _getSectionData(section) 按需加载并缓存
            → 按 catId 筛选 → 限流 → 渲染到地图
```

### 5.3 渲染限流规则

| 规则 | 条件 | 行为 |
|------|------|------|
| 网格限流 | scale < 6 | 每区每小类最多 10 个点 |
| 全量显示 | scale ≥ 6 | 显示全部可见 POI |
| 硬上限 | 始终 | 单次渲染不超过 1000 个 |
| 用户标记 | 始终 | 不受限流影响 |

---

## 六、注意事项

1. **category-map.js 需手动复制**：更新后需复制到 `miniprogram/packageMap/data/`
2. **section 文件由脚本生成**：不要手动编辑 `miniprogram/packageMap/data/poi/` 下的文件
3. **坐标系**：使用游戏内坐标，不是经纬度坐标
4. **emoji 兼容性**：已排除 Unicode 13.0+ 的不兼容 emoji（🪖、🪵、🪨 等）
5. **分类文件格式**：`分类/*.js` 是 `[id, catId, lng, lat, h]` 数组格式，section 文件是对象格式
