# SCUM游戏工具箱 - 微信小程序

## 快速开始

本项目采用**纯物理内置分包**架构，无需配置任何外部服务器或域名，真正实现零成本、零延迟秒开。

### 1. 地图数据说明
本项目的地图瓦片采用 **v50.0.2025.06.17-scum-1.0** 版本的数据源（来源于官方 scum-map）。
- **Z2 底图**：已内置在 `assets/tiles/2/0_0.jpg`（455KB），无需额外操作
- **Z4 瓦片**：通过 jsDelivr CDN 网络加载（GitHub 仓库 `mustard0207/scum_map`），首次加载后自动缓存到用户本地

### 2. 打开项目
1. 打开微信开发者工具。
2. 选择「导入项目」。
3. 项目目录选择 `miniprogram/` 文件夹。
4. AppID 填写：`wxb0d88d699aa1952d`（或你自己的 AppID）。
5. 点击「导入」。

### 3. 预览
- 点击工具栏的「预览」按钮，生成二维码用手机扫码预览。
- 或点击「真机调试」进行调试。

## 项目结构

```
miniprogram/
├── app.js/json/wxss         # 应用入口 + 全局配置（注册 subPackages）
├── pages/
│   ├── index/               # 首页（主包，轻量功能入口）
│   └── about/               # 关于页（主包）
├── packageMap/              # 地图分包（~86KB，Z4 瓦片走网络加载+本地缓存）
│   ├── pages/
│   │   └── map/             # 核心地图页面
│   └── components/
│       └── tile-map/        # 瓦片引擎（自定义 touch 手势 + CSS transform + 网络加载 + 本地缓存）
├── project.config.json      # 项目配置
└── sitemap.json             # SEO 配置
```

## 功能清单

### 一期核心

- [x] **首页** — 功能入口（地图卡片 + 更多工具占位）
- [x] **自定义手势地图引擎**
  - [x] 自定义 touch 手势（拖拽、惯性、双指缩放、双击缩放）
  - [x] CSS transform 渲染，抛弃 movable-view（真机兼容性问题）
  - [x] 分包物理直读，零网络请求、完全脱机可用
- [x] **坐标功能**
  - [x] 实时坐标显示
  - [x] 点击选点 + 坐标气泡
  - [x] 坐标跳转（支持游戏原始格式）
  - [x] 多点标记（上限 50 个）+ 信息窗口（删除/复制坐标/分享）
- [x] **纯前端分享**
  - [x] `<button open-type="share">` 触发微信原生分享面板
  - [x] 多标记一次性分享（所有标记编码进 URL）
  - [x] 接收分享还原全部标记并自动定位
  - [x] 旧格式 `x=&y=` 兼容
- [x] **区域网格系统**
  - [x] 5×5 网格分隔（D4→Z0），DOM 叠加层实现
  - [x] 线条粗细固定 1.5px，不随缩放变化
  - [x] 标签白字黑边描边，始终可读
  - [x] pointer-events: none，完全穿透手势

### 二期规划

- [ ] **POI 分类筛选**：按分类（军事、城镇、载具等）显示/隐藏标记点
- [ ] **原生 DOM 标记**：利用新架构，将 POI 转化为绝对定位的 DOM 节点进行超高性能渲染

## 技术细节

### 地图配置（Z2 本地 + Z4 网络加载）

| 参数 | 值 |
|------|-----|
| Z2 底图 | `assets/tiles/2/0_0.jpg` (本地内置, 455KB) |
| Z4 瓦片 | jsDelivr CDN 网络加载 + 本地缓存 |
| Z4 URL | `https://cdn.jsdelivr.net/gh/mustard0207/scum_map@main/4/{x}_{y}.webp` |
| Z4 缓存 | `wx.env.USER_DATA_PATH/scum_tiles/4/{col}_{row}.webp` |
| 总包体积 | ~600KB (极度安全) |

### 坐标系统
- **地理坐标系**：SCUM 游戏内坐标（经纬度）
- **引擎坐标系**：基于 CSS transform 的 `translate(x,y) scale(s)` 动态映射

### 分享参数格式
**新格式（多标记）**：
```
/packageMap/pages/map/map?markers=lng1,lat1,name1|lng2,lat2,name2|...
```

**旧格式兼容（单标记）**：
```
/packageMap/pages/map/map?x={longitude}&y={latitude}&name={encodedName}
```
