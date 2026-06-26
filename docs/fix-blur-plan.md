# 瓦片地图高清与高性能渲染重构方案 (WXS版)

## 1. 核心问题回顾

### 1.1 瓦片模糊问题 (Blur)
在原先的实现中，地图缩放是通过 CSS `transform: scale(...)` 作用在 `.map-canvas` 容器上的。这导致微信小程序/浏览器的 WebView 对内部的 `<image>` 元素进行了低分辨率光栅化（Rasterization）。图片虽然加载了高清的原始数据，但在渲染引擎层面，它是基于初始的 1280×1280 尺寸渲染后，再由 GPU 强行拉伸（降采样 + 最近邻/线性插值），导致严重的锯齿和模糊。

### 1.2 性能瓶颈问题 (Performance)
解决模糊问题最直接的方式是去掉 `transform: scale`，让所有瓦片基于最新的缩放比例动态计算 `left/top/width/height`。但如果在 JS 层的 `touchmove` 里每秒 60 次触发 `setData` 传递几十个瓦片的屏幕坐标，会导致小程序的 JS 线程与渲染线程之间发生严重的通信拥堵，造成明显的拖拽卡顿。

---

## 2. 最终架构设计：WXS 渲染接管方案

为了同时实现 **“极致高清”** 和 **“满帧流畅”**，我们采用小程序的 WXS (WeiXin Script) 直接在渲染层接管所有的手势逻辑和 DOM 样式更新。

### 2.1 WXML 结构调整
1. 移除 `<view class="map-canvas">` 上的 `style="transform: scale(...)"`。
2. 引入 `gestures.wxs`。
3. 把所有的 touch 事件 (`catchtouchstart`, `catchtouchmove`, `catchtouchend`) 绑定到 WXS 函数上，不再经过 JS 层。
4. 为瓦片 `<image>` 增加逻辑坐标的 data 属性：`data-lx`，`data-ly`，`data-lsize`。WXS 会直接读取这些固定属性进行缩放计算。

### 2.2 WXS (gestures.wxs) 核心逻辑
- **手势处理**：内部维护 `offsetX`, `offsetY`, `scale` 等状态。处理单指拖拽、双指捏合（Pinch Zoom），并内置了缓动逻辑和惯性滑动（Inertia）。
- **DOM 直接操作**：利用 `ownerInstance.selectAllComponents` 抓取地图瓦片、网格线和标记，利用 `setStyle` 在底层直接改变元素的 CSS，避开 `setData`。
- **渲染策略**：
  - **`map-canvas`**：动态改变 `width` 和 `height` (尺寸为 `1280 * scale`)，并通过 `transform: translate(ox, oy)` 进行整体偏移。这里仅使用 `translate`，绝不使用 `scale`，从而彻底解决模糊问题。
  - **`map-tile`**：由于包裹在 `map-canvas` 内部，瓦片自身的 `left` 和 `top` 只需乘以 `scale` 即可，不需要再叠加 `ox/oy`。
  - **网格与标记**：这些元素独立在 `map-canvas` 外部，直接根据屏幕偏移量和缩放量更新绝对位置。

### 2.3 JS 层的数据下发与回传 (状态同步)
虽然 WXS 接管了滑动，但业务逻辑（比如“回到中心”、“点击特定坐标进行跳转”）仍需要在 JS 中触发。

1. **JS 下发状态 (wxsState)**：
   JS 维护一个 `wxsState` 对象，并通过 `<view prop="{{wxsState}}" change:prop="{{gestures.propChange}}">` 下发给 WXS。一旦 JS 调用了跳转 API (例如 `zoomTo`, `moveToGeo`)，就会通过更新 `wxsState` 强行覆盖 WXS 的当前状态。
   - **防冲突机制 (`abort` 标记)**：如果地图正在惯性滑动，用户突然点击了跳转按钮，JS 会在 `wxsState` 中附带一个 `abort: Date.now()` 标记。WXS 监听到该标记变更时，会立即通过累加 `animId` 中断当前所有的 `requestAnimationFrame` 循环，防止坐标出现“打架”和回弹抖动。

2. **WXS 回传状态 (onGestureEnd)**：
   在 WXS 中，无论是惯性滑动停止，还是双击放大结束，最后都会通过 `ownerInstance.callMethod('onGestureEnd', { offsetX, offsetY, scale })` 将最新的视野坐标汇报给 JS 层。

3. **极其重要的细节：显式 setData 回填**：
   在 `onGestureEnd` 接收到 WXS 的新坐标后，必须使用**显式的对象路径形式**更新 `wxsState`，以确保微信底层框架真正捕获更新：
   ```javascript
   this.setData({
     'wxsState.offsetX': offsetX,
     'wxsState.offsetY': offsetY,
     'wxsState.scale': scale
   });
   ```
   如果只修改对象引用，在下一次其它事件触发 `setData` 时，旧缓存数据会被重新推给 WXS，导致地图出现**拖拽结束后瞬间弹回原位**的 Bug。

---

## 3. 动态标记点补偿 (TapDebug BugFix)

原有逻辑中，父页面监听标记点击事件 `bind:markertap` 时，依赖事件回调中附带的 `marker.screenX` 和 `marker.screenY`。但在 WXS 高性能方案中，标记点的屏幕位置在渲染层独立计算，JS 层数组中不再实时保有这些像素值。

**解决方案**：
在 `tile-map.js` 的 `onMarkerTap` 中，采用**按需计算**策略。当捕捉到用户点击标记时，利用当前的 `scale`、`offsetX` 和 `offsetY` 以及标记点的内部相对逻辑坐标 (`marker.px`, `marker.py`)，瞬间反推计算出该时刻真实的屏幕坐标，组装进 `marker` 对象中再向外 `triggerEvent`。

这样不仅保持了完全向后兼容（业务层无需任何修改），同时省去了在每一帧滑动中遍历所有 Marker 更新 `screenX/Y` 的高昂开销。

---

## 4. 结论

通过 WXS 深度重构，项目在实现完美 **高清不模糊** 瓦片地图的同时，维持了 60FPS 级别的顺滑手势体验。相关的代码路径已经完全稳定，后续新增地图层（如新增特定的涂鸦层或交互层）时，建议继续遵循上述“WXS直接操纵 `left/top/width/height`”的范式，严禁随意在 DOM 上叠加 `transform: scale`。
