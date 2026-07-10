---
name: run-sucm-tools
description: "POI data pipeline: merge category data and extract name labels from scum-map.com. Run: node tools/merge-poi-data.js and node tools/extract-names.js"
---

# SCUM 小助手 — POI 数据处理

从 scum-map.com 获取的分类数据合并为小程序可用的 section 文件，以及提取地名标签数据。

## 数据文件说明

### POI 点位数据

**输入**
- `点位数据/category-map.js` — 102 个分类定义（section/emoji/cnName）
- `点位数据/分类/*.js` — 102 个点位文件，`[id, catId, lng, lat, h]` 数组格式

**输出**
- `miniprogram/packageMap/data/category-map.js` — 直接复制
- `miniprogram/packageMap/data/poi/poi-{section}.js` — 按 section 合并（12 个文件，共 ~510KB）

### 地名标签数据

地名标签（城市/村庄名、桥梁名、街道名）硬编码在 scum-map.com 前端 JS bundle 中，非 GraphQL API。

**输出**（`点位数据/地名数据/`）
- `bridge-names.json` — 桥梁名称（3 个）
- `city-village-names.json` — 城市/村庄名称（96 个）
- `street-names.json` — 街道名称（52 条，Samobor 地区）
- `summary.json` — 汇总信息

## 操作流程

### 更新 POI 点位数据

```bash
# 1. 更新 category-map.js 和 分类/*.js（手动从 scum-map.com 获取）
# 2. 复制 category-map 到小程序目录
cp 点位数据/category-map.js miniprogram/packageMap/data/
# 3. 合并分类文件为 section 文件
node tools/merge-poi-data.js
```

### 更新地名标签数据

```bash
# 直接运行提取脚本（从 JS bundle 中正则提取）
node tools/extract-names.js
```

**注意**：JS bundle URL 含版本号（如 `v65.1.2026.07.08`），网站更新后需更新 `tools/extract-names.js` 中的 `bundleUrl`。获取方式：访问 scum-map.com 页面 HTML，查找 `cdn.scum-map.com/...app.js`。

### 更新中文翻译映射

地名的中文翻译来自 scum-map.com 的 i18n 翻译数据（`GetTranslationList` API 响应）。翻译数据保存在 `点位数据/地名数据/响应1.txt`。

更新步骤：
1. 在 scum-map.com 网络面板中找到 `GetTranslationList` 请求，保存响应到 `点位数据/地名数据/响应1.txt`
2. 从响应中提取地名翻译，更新 `tools/extract-names.js` 中的 `CN_TRANSLATIONS` 对象
3. 运行 `node tools/extract-names.js` 重新生成数据

当前翻译覆盖情况：
- 桥梁：3/3（100%）
- 城市/村庄：3/48（6.3%）— Novigrad、Samobor、Rogoznica
- 街道：40/52（76.9%）— 以欧洲城市名命名，直接翻译

### 修改 emoji

编辑 `点位数据/category-map.js`，复制到小程序目录，重新运行合并脚本。

**注意**：避免 Unicode 13.0+ emoji（🪖、🪵、🪨、🛖），部分设备不支持。

## section 文件大小

| 文件 | 大小 |
|------|------|
| poi-Crops.js | 162 KB |
| poi-Vehicles.js | 134 KB |
| poi-Buildings.js | 78 KB |
| poi-无分组.js | 50 KB |
| 其他 8 个文件 | < 25 KB 每个 |

## 坐标转换公式

地名标签的网站坐标（webLng/webLat）转游戏内坐标：

```
ingameLongitude = -4754.374 * webLng + 617900.013
ingameLatitude  = -4756.735 * webLat + 617499.890
```
