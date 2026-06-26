---
name: run-sucm-tools
description: "POI data pipeline: merge category data from scum-map.com into mini-program ready section files. Run: node tools/merge-poi-data.js"
---

# SCUM 小助手 — POI 数据处理

从 scum-map.com 导出的分类数据合并为小程序可用的 section 文件。

## 数据文件说明

### 输入

- `点位数据/category-map.js` — 102 个分类定义（section/emoji/cnName）
- `点位数据/分类/*.js` — 102 个点位文件，`[id, catId, lng, lat, h]` 数组格式

### 输出

- `miniprogram/packageMap/data/category-map.js` — 直接复制
- `miniprogram/packageMap/data/poi/poi-{section}.js` — 按 section 合并（12 个文件，共 ~510KB）

## 操作流程

### 更新数据

```bash
# 1. 更新 category-map.js 和 分类/*.js（手动）
# 2. 复制 category-map 到小程序目录
cp 点位数据/category-map.js miniprogram/packageMap/data/
# 3. 合并分类文件为 section 文件
node tools/merge-poi-data.js
```

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
