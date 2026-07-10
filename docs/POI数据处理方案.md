# POI数据处理方案

> 版本：v4.0 | 更新日期：2026-07-09

---

## 一、数据来源

### 1.1 原始数据

从 scum-map.com 网站获取，包含地图上所有 POI（兴趣点）标记和地名标签。

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
| Crops | 农作物 | 19 | 2842 |
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

## 六、地名标签数据

### 6.1 数据来源

地名标签数据（城市/村庄名称、桥梁名称、街道名称）**不是通过 GraphQL API 获取的**，而是硬编码在 scum-map.com 的前端 JS bundle 中。

**提取方式**：运行 `node tools/extract-names.js`，从 JS bundle 中正则提取。

### 6.2 数据文件

```
点位数据/地名数据/
├── bridge-names.json        ← 桥梁名称（3个）
├── city-village-names.json  ← 城市/村庄名称（96个）
├── street-names.json        ← 街道名称（52条，Samobor 地区）
└── summary.json             ← 汇总信息
```

### 6.3 坐标转换

桥梁和城市/村庄名称使用网站坐标（webLng/webLat），需转换为游戏内坐标：

```
ingameLongitude = -4754.374 * webLng + 617900.013
ingameLatitude  = -4756.735 * webLat + 617499.890
```

街道名称直接使用游戏内坐标（X, Y, Z）。

### 6.4 数据格式

**桥梁/城市/村庄**：
```json
{
  "name": "Prigorje",
  "webLng": 241,
  "webLat": 27.65625,
  "igLng": -527904.109,
  "igLat": 485946.428
}
```

**街道**：
```json
{
  "name": "Ankara Street",
  "igX": 324134.1906,
  "igY": 370635.0329,
  "igZ": 0,
  "rotate": 11
}
```

### 6.5 更新方式

1. 访问 scum-map.com，查看页面 HTML 中的 JS bundle URL（格式：`cdn.scum-map.com/v{版本}/build/{hash}.app.js`）
2. 更新 `tools/extract-names.js` 中的 `bundleUrl` 配置
3. 运行 `node tools/extract-names.js`

### 6.6 注意事项

- JS bundle URL 包含版本号，网站更新后需要更新 URL
- 街道数据仅限 Samobor 地区
- 桥梁名称只有 3 个（Dr. Tuđman Bridge、Krk Bridge、Pelješac Bridge）

---

## 七、注意事项

1. **category-map.js 需手动复制**：更新后需复制到 `miniprogram/packageMap/data/`
2. **section 文件由脚本生成**：不要手动编辑 `miniprogram/packageMap/data/poi/` 下的文件
3. **坐标系**：使用游戏内坐标，不是经纬度坐标
4. **emoji 兼容性**：已排除 Unicode 13.0+ 的不兼容 emoji（🪖、🪵、🪨 等）
5. **分类文件格式**：`分类/*.js` 是 `[id, catId, lng, lat, h]` 数组格式，section 文件是对象格式

---

## 八、新增数据或分类大类的维护流程

随着游戏版本的更新，可能会出现全新的 POI 分类或新的 Section（分类大类）。为了保证微信开发者工具的“代码保护”功能正常运行，当有新数据产生时，需要执行以下补充流程：

### 8.1 数据合并阶段
1. 将新的原始分类文件放入 `点位数据/分类/` 中。
2. 运行 `merge-poi-data.js` 脚本，它会自动根据 `category-map.js` 重新生成 `miniprogram/packageMap/data/poi/` 目录下的所有 `poi-xxx.js` 文件。

### 8.2 更新小程序端按需加载的 Switch 映射表 (非常关键)
为了让微信的**静态代码分析（代码保护机制）**能够正常打包这些新文件，并且实现零开销的按需懒加载，我们禁止使用动态 `require`（例如 `require('poi-' + section)`）。

当你在 `miniprogram/packageMap/data/poi/` 下发现**有新增的 Section 名称**（即生成了全新的 `poi-新名字.js` 文件），你**必须同步更新**地图主页的加载逻辑代码。

**操作步骤**：
1. 打开 `miniprogram/packageMap/pages/map/map.js` 文件。
2. 搜索 `_getSectionData(section)` 函数。
3. 找到内部的 `switch (section)` 语句，按照已有格式**手动增加一条对应的 case**：

```javascript
      switch (section) {
        // ... 已有的 cases
        case 'Buildings': sectionData = require('../../data/poi/poi-Buildings.js'); break;
        // 👇 新增的对应的 case（注意路径一定要是纯静态字符串）
        case '你的新Section名字': sectionData = require('../../data/poi/poi-你的新Section名字.js'); break;
      }
```
**注意**：如果你只是向已有的 Section（例如 `Buildings`）里面增加了新的坐标点位，而**没有增加新的大类 Section 文件**，则**不需要**修改 `map.js`，只重新跑脚本替换文件即可。
