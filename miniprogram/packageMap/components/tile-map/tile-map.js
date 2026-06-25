/**
 * SCUM 瓦片地图组件 (touch 手势版)
 *
 * 完全自定义手势：拖拽、惯性、双指缩放、双击缩放。
 * 不依赖 movable-view，避免真机兼容性问题。
 * 缩放以操作点（双指中心/双击位置）为锚点。
 */

const FULL_MAP_SIZE = 1280
const FULL_MAP_SRC = '/assets/tiles/2/0_0.jpg'
let MIN_SCALE = 0.2   // 初始值兜底，attached 中会动态更新为适屏比例
const PAN_MARGIN = 50 // 地图边缘允许超出视口的最大距离（像素）
const MAX_SCALE = 8
const INERTIA_FRICTION = 0.95   // 惯性衰减系数，越大滑得越远
const INERTIA_MIN_VEL = 0.5     // 最小速度阈值，低于此值停止惯性
const DOUBLE_TAP_TIMEOUT = 300  // 双击判定时间窗口（毫秒）

// 区域网格配置
const GRID_ROWS = 5
const GRID_COLS = 5
const GRID_CELL = FULL_MAP_SIZE / GRID_COLS  // 256
const GRID_LABELS_ROW = ['D', 'C', 'B', 'A', 'Z']
const GRID_LABELS_COL = ['4', '3', '2', '1', '0']
const GRID_LABEL_OFFSET = 8  // 标签距格子左上角的偏移量

// 瓦片分层加载配置
const TILE_LEVELS = {
  2: { gridSize: 1, tileSize: 1280, srcPrefix: '/assets/tiles/2/' },
  3: {
    gridSize: 2,
    tileSize: 1280,
    networkUrl: 'https://cdn.jsdelivr.net/gh/mustard0207/scum_map@main/3/{x}_{y}.webp',
    cacheDir: 'scum_tiles/3/'
  },
  4: {
    gridSize: 4,
    tileSize: 640,
    networkUrl: 'https://cdn.jsdelivr.net/gh/mustard0207/scum_map@main/4/{x}_{y}.webp',
    cacheDir: 'scum_tiles/4/'
  },
  6: {
    gridSize: 16,
    tileSize: 640,
    networkUrl: 'https://cdn.jsdelivr.net/gh/mustard0207/scum_map@main/6/{x}_{y}.webp',
    cacheDir: 'scum_tiles/6/'
  }
}
const Z3_SCALE_THRESHOLD = 1.0  // 超过此值切换到 Z3 瓦片
const Z4_SCALE_THRESHOLD = 1.5  // 超过此值切换到 Z4 瓦片
const Z6_SCALE_THRESHOLD = 3.0  // 超过此值切换到 Z6 瓦片

// 本地缓存管理
const CACHE_BASE = 'scum_tiles/'
const fs = wx.getFileSystemManager()

// 地图坐标范围（游戏坐标系）
const GEO_BOUNDS = {
  longitudeLeft: 619200,       // 地图左侧（经度）
  longitudeRight: -904800,     // 地图右侧（经度）
  latitudeTop: 619199.938,     // 地图顶部（纬度）
  latitudeBottom: -904800      // 地图底部（纬度）
}

Component({
  properties: {
    // 标记数组：[{ id, lng, lat, name }]
    markers: {
      type: Array,
      value: [],
      observer: function(newVal) {
        this._updateMarkersScreenPos()
      }
    }
  },

  data: {
    offsetX: 0,
    offsetY: 0,
    scale: 1,
    _vw: 375,
    _vh: 600,
    fullMapSrc: FULL_MAP_SRC,
    fullMapSize: FULL_MAP_SIZE,
    // 标记在屏幕上的位置数组
    markersOnScreen: [],
    // 可见瓦片列表（Z4 底层）
    visibleTiles: [],
    // Z6 叠加层（仅 Z6 激活时有值，叠在 Z4 上面）
    visibleTilesOverlay: [],
    // 区域网格数据
    gridLinesH: [],
    gridLinesV: [],
    gridLabels: []
  },

  lifetimes: {
    attached() {
      // 初始化瓦片缓存
      this._initTileCache()

      const { windowWidth } = wx.getWindowInfo()
      this._vw = windowWidth
      this._vh = 600 // 临时值，下面会用真实尺寸覆盖

      // 先用临时尺寸算一个近似初始状态，避免闪烁
      const tmpScale = Math.min(this._vw / FULL_MAP_SIZE, this._vh / FULL_MAP_SIZE)
      const tmpOX = (this._vw - FULL_MAP_SIZE * tmpScale) / 2
      const tmpOY = (this._vh - FULL_MAP_SIZE * tmpScale) / 2
      this.setData({ _vw: this._vw, _vh: this._vh, scale: tmpScale, offsetX: tmpOX, offsetY: tmpOY })

      // 用 boundingClientRect 获取组件真实渲染尺寸（由父页面布局决定）
      setTimeout(() => {
        wx.createSelectorQuery().in(this).select('.map-viewport').boundingClientRect(rect => {
          if (rect) {
            console.log(`[ViewportDebug] init: w=${rect.width} h=${rect.height} top=${rect.top} bottom=${rect.bottom}`)
            this._vw = rect.width
            this._vh = rect.height
          }

          this._initMap()
        }).exec()
      }, 50)
    },
    detached() {
      if (this._inertiaTimer) clearTimeout(this._inertiaTimer)
      if (this._zoomAnimTimer) clearTimeout(this._zoomAnimTimer)
    }
  },

  methods: {

    /** 初始化地图（拿到真实视口尺寸后调用） */
    _initMap() {
      // 让地图完全显示在屏幕中（取宽高比的较小值）
      const scale = Math.min(this._vw / FULL_MAP_SIZE, this._vh / FULL_MAP_SIZE)

      // 最小缩放 = 适屏比例（放大后仍能缩回全图状态）
      MIN_SCALE = scale

      // 居中显示：地图左上角 = 屏幕中心 - 地图中心 * scale
      const offsetX = (this._vw - FULL_MAP_SIZE * scale) / 2
      const offsetY = (this._vh - FULL_MAP_SIZE * scale) / 2

      this.setData({ offsetX, offsetY, scale, _vw: this._vw, _vh: this._vh })

      this._initGrid()
      this._refreshOverlay()

      this._inertiaTimer = null
      this._velX = 0
      this._velY = 0
      this._tileIds = ''  // 当前可见瓦片 id 缓存，用于变化检测
    },

    // ================================================================
    // 触摸事件
    // ================================================================

    onTouchStart(e) {
      if (this._inertiaTimer) {
        clearTimeout(this._inertiaTimer)
        this._inertiaTimer = null
      }

      const touches = e.touches
      if (touches.length === 1) {
        // 单指开始
        this._isPinching = false
        this._lastX = touches[0].clientX
        this._lastY = touches[0].clientY
        this._lastTime = Date.now()
        this._touchStartX = touches[0].clientX
        this._touchStartY = touches[0].clientY
        this._velX = 0
        this._velY = 0
        this._isDrag = false
      } else if (touches.length === 2) {
        // 双指开始：重置拖拽状态，避免松手时触发惯性
        this._isPinching = true
        this._isDrag = false
        this._velX = 0
        this._velY = 0
        this._pinchStartDist = this._getTouchDist(touches)
        this._pinchStartScale = this.data.scale
        this._pinchStartOffsetX = this.data.offsetX
        this._pinchStartOffsetY = this.data.offsetY
      }
    },

    onTouchMove(e) {
      const touches = e.touches

      // 双指缩放中，只剩一个手指时忽略
      if (this._isPinching && touches.length < 2) return

      if (touches.length === 1 && this._lastX !== undefined && !this._isPinching) {
        // 单指拖拽
        const dx = touches[0].clientX - this._lastX
        const dy = touches[0].clientY - this._lastY
        const now = Date.now()
        const dt = now - this._lastTime

        if (dt > 0) {
          this._velX = dx / dt
          this._velY = dy / dt
        }

        this._lastX = touches[0].clientX
        this._lastY = touches[0].clientY
        this._lastTime = now
        this._isDrag = true

        this.data.offsetX += dx
        this.data.offsetY += dy
        this._clampOffset()
        this.setData({ offsetX: this.data.offsetX, offsetY: this.data.offsetY })
        this._refreshOverlay()
      } else if (touches.length === 2 && this._pinchStartDist) {
        // 双指缩放：以双指中心为锚点
        const dist = this._getTouchDist(touches)
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, this._pinchStartScale * (dist / this._pinchStartDist)))

        // 双指中心点（屏幕坐标）
        const cx = (touches[0].clientX + touches[1].clientX) / 2
        const cy = (touches[0].clientY + touches[1].clientY) / 2

        const s0 = this._pinchStartScale
        const s1 = newScale
        const ox0 = this._pinchStartOffsetX
        const oy0 = this._pinchStartOffsetY

        // 公式：newOffset = pinchCenter - (pinchCenter - oldOffset) * newScale / oldScale
        const newOffsetX = cx - (cx - ox0) * s1 / s0
        const newOffsetY = cy - (cy - oy0) * s1 / s0

        this.data.offsetX = newOffsetX
        this.data.offsetY = newOffsetY
        this.data.scale = newScale  // 先更新 scale，让 _clampOffset 用新值计算边界
        this._clampOffset()
        this.setData({
          scale: this.data.scale,
          offsetX: this.data.offsetX,
          offsetY: this.data.offsetY
        })
        this._refreshOverlay()
      }
    },

    onTouchEnd(e) {
      if (e.touches.length === 0) {
        // 只有单指拖拽后才启动惯性
        if (!this._isPinching && this._isDrag && (Math.abs(this._velX) > INERTIA_MIN_VEL || Math.abs(this._velY) > INERTIA_MIN_VEL)) {
          this._startInertia()
        }

        // 检测点击：手指总移动距离 < 10px 视为点击（不依赖 _isDrag，因为手机触摸总有微小位移）
        if (!this._isPinching && this._touchStartX !== undefined) {
          const endX = e.changedTouches[0].clientX
          const endY = e.changedTouches[0].clientY
          const dist = Math.abs(endX - this._touchStartX) + Math.abs(endY - this._touchStartY)
          if (dist < 10) {
            this._handleTap(endX, endY)
          }
        }

        this._lastX = undefined
        this._lastY = undefined
        this._isDrag = false
        this._isPinching = false
      }
    },

    /** 在 touchEnd 中检测双击 */
    _handleTap(x, y) {
      const now = Date.now()
      if (
        this._lastTapTime &&
        now - this._lastTapTime < DOUBLE_TAP_TIMEOUT &&
        this._lastTapX !== undefined &&
        Math.abs(x - this._lastTapX) < 30 &&
        Math.abs(y - this._lastTapY) < 30
      ) {
        // 双击确认
        this._lastTapTime = 0
        this._lastTapX = undefined

        const curScale = this.data.scale
        const targetScale = curScale >= 2 ? 1 : Math.min(MAX_SCALE, curScale * 2)
        this._animateZoomTo(targetScale, x, y)
      } else {
        this._lastTapTime = now
        this._lastTapX = x
        this._lastTapY = y
      }
    },

    // ================================================================
    // 惯性动画
    // ================================================================

    _startInertia() {
      const animate = () => {
        this._velX *= INERTIA_FRICTION
        this._velY *= INERTIA_FRICTION

        if (Math.abs(this._velX) < INERTIA_MIN_VEL && Math.abs(this._velY) < INERTIA_MIN_VEL) {
          this._inertiaTimer = null
          return
        }

        this.data.offsetX += this._velX * 16
        this.data.offsetY += this._velY * 16
        this._clampOffset()
        this.setData({ offsetX: this.data.offsetX, offsetY: this.data.offsetY })
        this._refreshOverlay()

        this._inertiaTimer = setTimeout(animate, 16)
      }
      this._inertiaTimer = setTimeout(animate, 16)
    },

    // ================================================================
    // 工具函数
    // ================================================================

    _getTouchDist(touches) {
      const dx = touches[0].clientX - touches[1].clientX
      const dy = touches[0].clientY - touches[1].clientY
      return Math.sqrt(dx * dx + dy * dy)
    },

    /** 限制地图不被完全拖出视口：至少保留 PAN_MARGIN 像素在视口内 */
    _clampOffset() {
      const mapW = FULL_MAP_SIZE * this.data.scale
      const mapH = FULL_MAP_SIZE * this.data.scale
      let { offsetX, offsetY } = this.data

      // 左边缘：地图右侧至少露出 PAN_MARGIN
      if (offsetX + mapW < PAN_MARGIN) offsetX = PAN_MARGIN - mapW
      // 右边缘：地图左侧至少露出 PAN_MARGIN
      if (offsetX > this._vw - PAN_MARGIN) offsetX = this._vw - PAN_MARGIN
      // 上边缘：地图底部至少露出 PAN_MARGIN
      if (offsetY + mapH < PAN_MARGIN) offsetY = PAN_MARGIN - mapH
      // 下边缘：地图顶部至少露出 PAN_MARGIN
      if (offsetY > this._vh - PAN_MARGIN) offsetY = this._vh - PAN_MARGIN

      this.data.offsetX = offsetX
      this.data.offsetY = offsetY
    },

    // ================================================================
    // 瓦片分层加载 + 本地缓存
    // ================================================================

    /** 初始化瓦片缓存：扫描本地已缓存的瓦片文件 */
    _initTileCache() {
      this._cachedTiles = new Set()
      // 扫描 Z3、Z4、Z6 缓存目录
      ;[3, 4, 6].forEach(level => {
        const cacheDir = `${wx.env.USER_DATA_PATH}/${TILE_LEVELS[level].cacheDir}`
        try {
          fs.accessSync(cacheDir)
          const files = fs.readdirSync(cacheDir)
          files.forEach(file => {
            if (file.endsWith('.webp')) {
              this._cachedTiles.add(`${level}_${file.replace('.webp', '')}`)
            }
          })
        } catch (e) {
          // 该层级缓存目录不存在
        }
      })
    },

    /** 检查瓦片是否已缓存 */
    _isTileCached(level, col, row) {
      return this._cachedTiles.has(`${level}_${col}_${row}`)
    },

    /** 获取瓦片 src：优先本地缓存，否则用网络 URL */
    _getTileSrc(level, col, row) {
      const cfg = TILE_LEVELS[level]
      if (level === 2) return cfg.srcPrefix + '0_0.jpg'
      // Z4/Z6: 优先缓存
      if (this._isTileCached(level, col, row)) {
        return `${wx.env.USER_DATA_PATH}/${cfg.cacheDir}${col}_${row}.webp`
      }
      return cfg.networkUrl.replace('{x}', col).replace('{y}', row)
    },

    /** 瓦片从网络加载成功后，保存到本地缓存 */
    _saveTileToCache(level, col, row) {
      const cfg = TILE_LEVELS[level]
      const url = cfg.networkUrl.replace('{x}', col).replace('{y}', row)
      const cacheDir = `${wx.env.USER_DATA_PATH}/${cfg.cacheDir}`
      const cachePath = `${cacheDir}${col}_${row}.webp`

      wx.downloadFile({
        url: url,
        success: (res) => {
          if (res.statusCode === 200) {
            try { fs.mkdirSync(cacheDir, true) } catch (e) {}
            fs.saveFile({
              tempFilePath: res.tempFilePath,
              filePath: cachePath,
              success: () => {
                this._cachedTiles.add(`${level}_${col}_${row}`)
              },
              fail: (err) => console.warn('缓存保存失败:', err)
            })
          }
        }
      })
    },

    /** 根据缩放级别返回当前应使用的瓦片层级 */
    _getActiveTileLevel(scale) {
      if (scale >= Z6_SCALE_THRESHOLD) return 6
      if (scale >= Z4_SCALE_THRESHOLD) return 4
      if (scale >= Z3_SCALE_THRESHOLD) return 3
      return 2
    },

    /** DEBUG: 打印当前缩放和瓦片状态 */
    _debugTiles(level, z4Count, overlayCount) {
      const scale = this.data.scale
      console.log(`[TileDebug] scale=${scale.toFixed(2)} level=${level} z4=${z4Count} z6=${overlayCount}`)
    },

    /** 计算视口内可见瓦片列表 */
    _getVisibleTiles(level) {
      const cfg = TILE_LEVELS[level]
      if (level === 2 || this.data.scale <= 0) return []  // Z2 无需瓦片网格；scale=0 防御

      const logicalSize = FULL_MAP_SIZE / cfg.gridSize  // Z3: 640, Z4: 320, Z6: 80
      const { offsetX, offsetY, scale } = this.data

      // 视口在逻辑坐标系中的范围
      const logicalLeft = -offsetX / scale
      const logicalTop = -offsetY / scale
      const logicalRight = (this._vw - offsetX) / scale
      const logicalBottom = (this._vh - offsetY) / scale

      // 可见瓦片的行列范围（用 ceil-1 避免边界多算一格）
      const colStart = Math.max(0, Math.floor(logicalLeft / logicalSize))
      const colEnd = Math.min(cfg.gridSize - 1, Math.ceil(logicalRight / logicalSize) - 1)
      const rowStart = Math.max(0, Math.floor(logicalTop / logicalSize))
      const rowEnd = Math.min(cfg.gridSize - 1, Math.ceil(logicalBottom / logicalSize) - 1)

      const tiles = []
      for (let r = rowStart; r <= rowEnd; r++) {
        for (let c = colStart; c <= colEnd; c++) {
          tiles.push({
            id: `tile_${level}_${r}_${c}`,
            src: this._getTileSrc(level, c, r),
            left: c * logicalSize,
            top: r * logicalSize,
            w: logicalSize,
            h: logicalSize
          })
        }
      }
      return tiles
    },

    /** 计算瓦片数据（供 _refreshOverlayAnim 调用，不单独 setData） */
    _computeTileData() {
      const newLevel = this._getActiveTileLevel(this.data.scale)

      let primaryTiles = []
      let overlayTiles = []
      if (newLevel === 6) {
        // Z6 激活：Z4 作为兜底层，Z6 作为叠加层
        primaryTiles = this._getVisibleTiles(4)
        overlayTiles = this._getVisibleTiles(6)
      } else if (newLevel >= 3) {
        // Z3/Z4：仅主层（Z2 始终作为背景兜底）
        primaryTiles = this._getVisibleTiles(newLevel)
      }

      // 比较 id 数组，仅在变化时返回新数据
      const newIds = primaryTiles.map(t => t.id).join(',') + '|' + overlayTiles.map(t => t.id).join(',')
      if (newIds === this._tileIds) return {}
      this._tileIds = newIds
      this._debugTiles(newLevel, primaryTiles.length, overlayTiles.length)
      return { visibleTiles: primaryTiles, visibleTilesOverlay: overlayTiles }
    },

    /** 更新所有标记在屏幕上的位置（缩放动画期间跳过，由动画统一刷新） */
    _updateMarkersScreenPos() {
      if (this._isAnimatingZoom) return
      this._doUpdateMarkersScreenPos()
    },

    /** 合并刷新标记+网格（非动画路径，跳过动画期间的冗余更新） */
    _refreshOverlay() {
      if (this._isAnimatingZoom) return
      this._refreshOverlayAnim()
    },

    /** 合并刷新标记+网格（动画路径，始终执行） */
    _refreshOverlayAnim() {
      const { offsetX, offsetY, scale, markers } = this.data

      // 标记位置
      let markersOnScreen = []
      if (markers && markers.length > 0) {
        markersOnScreen = markers.map(marker => {
          if (!marker.lng || !marker.lat) return null
          const pixelX = (marker.lng - GEO_BOUNDS.longitudeLeft) / (GEO_BOUNDS.longitudeRight - GEO_BOUNDS.longitudeLeft) * FULL_MAP_SIZE
          const pixelY = (marker.lat - GEO_BOUNDS.latitudeTop) / (GEO_BOUNDS.latitudeBottom - GEO_BOUNDS.latitudeTop) * FULL_MAP_SIZE
          const screenX = pixelX * scale + offsetX
          const screenY = pixelY * scale + offsetY
          const visible = screenX >= -20 && screenX <= this._vw + 20 &&
                          screenY >= -20 && screenY <= this._vh + 20
          return visible ? { ...marker, screenX, screenY } : null
        }).filter(Boolean)
      }

      // 网格位置（线条裁剪到地图可见区域）
      const mapLeft = Math.max(0, offsetX)
      const mapRight = Math.min(this._vw, FULL_MAP_SIZE * scale + offsetX)
      const mapTop = Math.max(0, offsetY)
      const mapBottom = Math.min(this._vh, FULL_MAP_SIZE * scale + offsetY)

      const gridLinesH = this.data.gridLinesH.map((line, i) => ({
        ...line,
        y: (i + 1) * GRID_CELL * scale + offsetY,
        left: mapLeft,
        right: this._vw - mapRight
      }))
      const gridLinesV = this.data.gridLinesV.map((line, j) => ({
        ...line,
        x: (j + 1) * GRID_CELL * scale + offsetX,
        top: mapTop,
        bottom: this._vh - mapBottom
      }))
      const gridLabels = this.data.gridLabels.map((label, idx) => ({
        ...label,
        x: (idx % GRID_COLS) * GRID_CELL * scale + offsetX + GRID_LABEL_OFFSET,
        y: Math.floor(idx / GRID_COLS) * GRID_CELL * scale + offsetY + GRID_LABEL_OFFSET
      }))

      // 瓦片数据（仅在变化时附带，不增加 setData 次数）
      const tileData = this._computeTileData()

      this.setData({ markersOnScreen, gridLinesH, gridLinesV, gridLabels, ...tileData })
    },

    // ================================================================
    // 公共 API
    // ================================================================

    /** 跳转到游戏坐标 */
    moveToGeo(geoLng, geoLat) {
      // 检查坐标是否在范围内
      if (!this.isInBounds(geoLng, geoLat)) {
        console.warn('坐标超出地图范围:', geoLng, geoLat)
        return false
      }

      // 游戏坐标 → 地图像素坐标
      const pixelX = (geoLng - GEO_BOUNDS.longitudeLeft) / (GEO_BOUNDS.longitudeRight - GEO_BOUNDS.longitudeLeft) * FULL_MAP_SIZE
      const pixelY = (geoLat - GEO_BOUNDS.latitudeTop) / (GEO_BOUNDS.latitudeBottom - GEO_BOUNDS.latitudeTop) * FULL_MAP_SIZE

      // 地图像素坐标 → 屏幕偏移（让该点对齐屏幕中心）
      const { scale } = this.data
      this.data.offsetX = this._vw / 2 - pixelX * scale
      this.data.offsetY = this._vh / 2 - pixelY * scale
      this._clampOffset()

      this.setData({ offsetX: this.data.offsetX, offsetY: this.data.offsetY })
      this._refreshOverlay()
      return true
    },

    /** 屏幕坐标 → 游戏坐标 */
    screenToGeo(screenX, screenY) {
      const { offsetX, offsetY, scale } = this.data

      // 屏幕坐标 → 地图像素坐标
      const pixelX = (screenX - offsetX) / scale
      const pixelY = (screenY - offsetY) / scale

      // 地图像素坐标 → 游戏坐标
      const geoLng = GEO_BOUNDS.longitudeLeft + (pixelX / FULL_MAP_SIZE) * (GEO_BOUNDS.longitudeRight - GEO_BOUNDS.longitudeLeft)
      const geoLat = GEO_BOUNDS.latitudeTop + (pixelY / FULL_MAP_SIZE) * (GEO_BOUNDS.latitudeBottom - GEO_BOUNDS.latitudeTop)

      return { lng: Math.round(geoLng), lat: Math.round(geoLat) }
    },

    /** 游戏坐标 → 屏幕坐标 */
    geoToScreen(geoLng, geoLat) {
      const { offsetX, offsetY, scale } = this.data

      // 游戏坐标 → 地图像素坐标
      const pixelX = (geoLng - GEO_BOUNDS.longitudeLeft) / (GEO_BOUNDS.longitudeRight - GEO_BOUNDS.longitudeLeft) * FULL_MAP_SIZE
      const pixelY = (geoLat - GEO_BOUNDS.latitudeTop) / (GEO_BOUNDS.latitudeBottom - GEO_BOUNDS.latitudeTop) * FULL_MAP_SIZE

      // 地图像素坐标 → 屏幕坐标
      const screenX = pixelX * scale + offsetX
      const screenY = pixelY * scale + offsetY

      return { x: screenX, y: screenY }
    },

    /** 检查坐标是否在地图范围内 */
    isInBounds(geoLng, geoLat) {
      const minLng = Math.min(GEO_BOUNDS.longitudeLeft, GEO_BOUNDS.longitudeRight)
      const maxLng = Math.max(GEO_BOUNDS.longitudeLeft, GEO_BOUNDS.longitudeRight)
      const minLat = Math.min(GEO_BOUNDS.latitudeTop, GEO_BOUNDS.latitudeBottom)
      const maxLat = Math.max(GEO_BOUNDS.latitudeTop, GEO_BOUNDS.latitudeBottom)

      return geoLng >= minLng && geoLng <= maxLng && geoLat >= minLat && geoLat <= maxLat
    },

    /** 获取地图坐标范围 */
    getGeoBounds() {
      return { ...GEO_BOUNDS }
    },

    resetView() {
      if (this._inertiaTimer) {
        clearTimeout(this._inertiaTimer)
        this._inertiaTimer = null
      }
      const scale = Math.min(this._vw / FULL_MAP_SIZE, this._vh / FULL_MAP_SIZE)
      const offsetX = (this._vw - FULL_MAP_SIZE * scale) / 2
      const offsetY = (this._vh - FULL_MAP_SIZE * scale) / 2
      this.setData({ offsetX, offsetY, scale })
      this._refreshOverlay()
    },

    /** 重新计算视口尺寸（底栏高度变化后调用） */
    recalcViewport(height) {
      if (height) this._vh = height
      this._initMap()
      console.log(`[ViewportDebug] recalc: w=${this._vw} h=${this._vh}`)
    },

    /** 获取当前缩放值 */
    getScale() {
      return this.data.scale
    },

    /** 获取最小缩放值（全局视角） */
    getMinScale() {
      return MIN_SCALE
    },

    /** 以指定中心点缩放到目标值 */
    zoomTo(targetScale, cx, cy) {
      this._animateZoomTo(targetScale, cx, cy)
    },

    // ================================================================
    // 双击缩放（在 _handleTap 中实现）
    // ================================================================

    /**
     * 平滑缩放动画：从当前 scale 过渡到 targetScale，以 (cx, cy) 为锚点
     */
    _animateZoomTo(targetScale, cx, cy) {
      if (this._inertiaTimer) {
        clearTimeout(this._inertiaTimer)
        this._inertiaTimer = null
      }

      const DURATION = 200
      const startScale = this.data.scale
      const startOX = this.data.offsetX
      const startOY = this.data.offsetY
      const finalOX = cx - (cx - startOX) * targetScale / startScale
      const finalOY = cy - (cy - startOY) * targetScale / startScale
      const startTime = Date.now()

      this._isAnimatingZoom = true

      const step = () => {
        const elapsed = Date.now() - startTime
        const t = Math.min(1, elapsed / DURATION)
        // ease-out cubic
        const ease = 1 - Math.pow(1 - t, 3)

        const curScale = startScale + (targetScale - startScale) * ease
        const curOX = startOX + (finalOX - startOX) * ease
        const curOY = startOY + (finalOY - startOY) * ease

        this.data.offsetX = curOX
        this.data.offsetY = curOY
        this.data.scale = curScale  // 先更新 scale，让 _clampOffset 用新值计算边界
        this._clampOffset()
        this.setData({ scale: this.data.scale, offsetX: this.data.offsetX, offsetY: this.data.offsetY })
        // 动画期间手动刷新标记位置和网格（合并为一次 setData）
        this._refreshOverlayAnim()

        if (t < 1) {
          this._zoomAnimTimer = setTimeout(step, 16)
        } else {
          this._isAnimatingZoom = false
          this._zoomAnimTimer = null
          this._refreshOverlayAnim()
        }
      }

      if (this._zoomAnimTimer) clearTimeout(this._zoomAnimTimer)
      step()
    },

    // ================================================================
    // 标记位置计算（内部实现）
    // ================================================================

    /** 初始化网格静态数据（仅调用一次） */
    _initGrid() {
      const gridLinesH = []
      const gridLinesV = []
      const gridLabels = []

      // 4 条内部分隔横线（i = 1..4）
      for (let i = 1; i < GRID_ROWS; i++) {
        gridLinesH.push({ id: 'h' + i })
      }
      // 4 条内部分隔竖线（j = 1..4）
      for (let j = 1; j < GRID_COLS; j++) {
        gridLinesV.push({ id: 'v' + j })
      }
      // 25 个标签
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          gridLabels.push({
            id: 'lbl_' + r + '_' + c,
            text: GRID_LABELS_ROW[r] + GRID_LABELS_COL[c]
          })
        }
      }

      this.setData({ gridLinesH, gridLinesV, gridLabels })
    },

    /** 实际执行标记位置更新（被 _updateMarkersScreenPos 和动画调用） */
    _doUpdateMarkersScreenPos() {
      const markers = this.data.markers
      if (!markers || markers.length === 0) {
        if (this.data.markersOnScreen.length > 0) {
          this.setData({ markersOnScreen: [] })
        }
        return
      }

      const markersOnScreen = markers.map(marker => {
        if (!marker.lng || !marker.lat) return null
        const screenPos = this.geoToScreen(marker.lng, marker.lat)
        const visible = screenPos.x >= -20 && screenPos.x <= this._vw + 20 &&
                        screenPos.y >= -20 && screenPos.y <= this._vh + 20
        return visible ? { ...marker, screenX: screenPos.x, screenY: screenPos.y } : null
      }).filter(Boolean)

      this.setData({ markersOnScreen })
    },

    onImageError(e) {
      console.error('底图加载失败:', e.detail?.errMsg)
    },

    onImageLoad() {
      console.log('底图加载成功')
    },

    onTileError(e) {
      console.error(`[TileError] ${e.currentTarget?.dataset?.id} ${e.detail?.errMsg}`)
    },

    /** 瓦片加载成功：如果是网络加载，保存到本地缓存 */
    onTileLoad(e) {
      const id = e.currentTarget?.dataset?.id
      if (!id) return
      const parts = id.split('_')  // tile_{level}_{row}_{col}
      const level = parseInt(parts[1])
      const r = parseInt(parts[2])
      const c = parseInt(parts[3])
      const cached = this._isTileCached(level, c, r)
      console.log(`[TileLoad] ${id} level=${level} cached=${cached}`)
      // 如果是从网络加载的（未缓存），保存到本地
      if (level >= 4 && !cached) {
        this._saveTileToCache(level, c, r)
      }
    },

    /** 标记点击事件 */
    onMarkerTap(e) {
      console.log('tile-map onMarkerTap:', e)
      const markerId = e.currentTarget.dataset.id
      console.log('markerId:', markerId)
      console.log('markersOnScreen:', this.data.markersOnScreen)
      const marker = this.data.markersOnScreen.find(m => m.id === markerId)
      console.log('found marker:', marker)
      if (marker) {
        this.triggerEvent('markertap', { marker })
      }
    }
  }
})
