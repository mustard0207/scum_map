# AI 开发避坑指南 (SCUM 瓦片地图模块)

本文件记录了 SCUM 小助手地图组件 (`tile-map`) 开发中的关键性能点和血泪避坑经验，后续维护或新增功能时 **必须严格遵守**。

## 1. WXS 动画与 JS 数据同步（惯性打断问题）
- **现象**：当 WXS 正在进行平滑的惯性动画时，如果 JS 侧执行了 `setData` 并且带入了旧的坐标值（如 `offsetX`/`offsetY`），会强行打断 WXS 动画，导致屏幕发生严重闪跳。
- **解决方案与规范**：
  - **使用 `syncId` 机制**：`wxsState` 对象中已引入 `syncId`。
  - 当 JS 侧仅仅是为了触发重绘（比如只更新了 `markers` 的 DOM），不应改变 `syncId`，只需改变 `wxsState.trigger = Date.now()`。
  - WXS 端的 `propChange` 侦听到变化时，**必须且仅在** `newVal.syncId !== state.syncId` 时，才将 `newVal.offsetX` 等位置信息覆盖掉内部的 `state.offsetX`。
  - 当 JS 侧主动发生视口跳转（如回原点、输入坐标），需要调用 `_syncWxsState(true)` 递增 `syncId`，显式通知 WXS “听我的，改变坐标并终止惯性”。

## 2. 大量 POI 标记的限流与闪烁（聚合策略）
- **坑点**：之前基于屏幕坐标（`px`、`py`）进行网格聚合，用户稍微拖动一点点地图，标记的屏幕坐标就会改变，导致原本聚合的标记重新分组，图标在屏幕上疯狂闪烁消失。
- **解决方案与规范**：
  - **基于“游戏逻辑坐标”聚合**：所有 POI 数据在筛选时一次性转换为 地图固定范围逻辑像素（如 0~1280），此缓存 `_poiPixelCache` 不受地图拖拽影响。
  - **自适应聚合网格**：`cellSize = MIN_SCREEN_DIST / scale`。随缩放比例动态计算格网大小，使得聚合完全自适应，且放大到设定阈值（`SCALE_THRESHOLD`）以上时自动关闭聚合。
  - **硬上限保护**：任何情况下，经过聚合和视口裁剪后，最终传入 `setData` 生成 DOM 的 `markersOnScreen` **不得超过 200 个** (`MAX_POI_RENDER`)，以防止小程序内存爆掉和渲染卡顿。
  - **及时刷新**：任何程序化的视口变动（`jumpToCoord`, `resetMapView`, 缩放滑块结束），**必须主动调用 `this._schedulePoiRefresh()`**，否则会导致视口移出原有裁剪区后，部分图标没有刷出来。

## 3. DOM 元素在 WXS 层级下的点击失效
- **坑点**：如果给 `.map-viewport`（或同级底层）加上了 `catchtouchstart` 让 WXS 处理平移缩放，那么在其内部的所有子元素（如 `.map-marker`）的 `bindtap` / `catchtap` 都**不会再被触发**，因为底层事件冒泡完全被吞掉了。
- **解决方案与规范**：
  - **点反查策略**：在 WXS 层的触摸手势中，通过分析 `touchstart` 与 `touchend` 的位移和时间差，识别出明确的“单击”行为。
  - WXS 识别到单击后，调用 `ownerInstance.callMethod('onTapAtPoint', {x,y})`，把触摸的**屏幕绝对坐标**传回 JS 侧。
  - JS 侧使用碰撞检测算法（将屏幕坐标转换为内部相对坐标后，与当前视口内所有已知 `markers` 的 `px/py` 比对），一旦距离小于 `HIT_RADIUS` 即判定点击，再主动触发选中逻辑。
