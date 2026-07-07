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

// 自定义标记类型颜色
const MARKER_TYPE_COLORS = {
  house:   '#6BBF59',
  vehicle: '#6BBF59',
  box:     '#6BBF59'
}

// 安全区（交易区）配置 — 圆心坐标与半径来自游戏内实测数据
const SAFE_ZONES = [
  { id: 'sz_a0', name: 'A0 安全区', lng: -610818, lat: -556433, radius: 50000 },
  { id: 'sz_b4', name: 'B4 安全区', lng: 570708,  lat: -226174, radius: 30000 },
  { id: 'sz_c2', name: 'C2 安全区', lng: -147082, lat: 278432,  radius: 50000 },
  { id: 'sz_z3', name: 'Z3 安全区', lng: 12820,   lat: -678344, radius: 50000 }
]

// 区域网格配置
const GRID_ROWS = 5
const GRID_COLS = 5
const GRID_CELL = FULL_MAP_SIZE / GRID_COLS  // 256
const GRID_LABELS_ROW = ['D', 'C', 'B', 'A', 'Z']
const GRID_LABELS_COL = ['4', '3', '2', '1', '0']
const GRID_LABEL_OFFSET = 4  // 标签距格子左上角的偏移量

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
    },
    // 狩猎区数组：[{ x, y, r, color }] (游戏坐标)
    huntingZones: {
      type: Array,
      value: [],
      observer: function(newVal) {
        this._updateMarkersScreenPos() // 共用刷新逻辑
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
    wxsState: {},
    // 标记在屏幕上的位置数组
    markersOnScreen: [],
    // 可见瓦片列表（Z4 底层）
    visibleTiles: [],
    // Z6 叠加层（仅 Z6 激活时有值，叠在 Z4 上面）
    visibleTilesOverlay: [],
    // 区域网格数据
    gridLinesH: [],
    gridLinesV: [],
    gridLabels: [],
    // 安全区圆圈
    safeZonesOnScreen: [],
    // 狩猎区圆圈 (屏幕裁剪后)
    huntingZonesOnScreen: []
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
            // console.log(`[ViewportDebug] init: w=${rect.width} h=${rect.height} top=${rect.top} bottom=${rect.bottom}`)
            this._vw = rect.width
            this._vh = rect.height
            this._vpLeft = rect.left || 0
            this._vpTop = rect.top || 0
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

      this._tileIds = ''  // 当前可见瓦片 id 缓存，用于变化检测
      this._initGrid()
      this._initSafeZones()
      this._syncWxsState(true) // 强制 WXS 同步最新的初始坐标和缩放
      this._refreshOverlay()
      // 通知父页面地图已就绪
      this.triggerEvent('mapready')
    },

    // ================================================================
    // WXS 同步与回调
    // ================================================================

    _syncWxsState(abortAnimation = false) {
      this._wxsSyncId = (this._wxsSyncId || 0) + 1;
      const stateObj = {
        offsetX: this.data.offsetX,
        offsetY: this.data.offsetY,
        scale: this.data.scale,
        vw: this._vw,
        vh: this._vh,
        minScale: MIN_SCALE,
        syncId: this._wxsSyncId,
        trigger: Date.now()
      };
      if (abortAnimation) stateObj.abort = Date.now();
      
      this.setData({ wxsState: stateObj });
    },

    onGestureEnd(e) {
      const { offsetX, offsetY, scale } = e;
      this.data.offsetX = offsetX;
      this.data.offsetY = offsetY;
      this.data.scale = scale;
      this._wxsSyncId = (this._wxsSyncId || 0) + 1;
      // 使用显式的 setData 同步状态，带 syncId 让 WXS 知道这是位置同步
      this.setData({
        'wxsState.offsetX': offsetX,
        'wxsState.offsetY': offsetY,
        'wxsState.scale': scale,
        'wxsState.syncId': this._wxsSyncId
      });
      this._refreshOverlayAnim();
      // 通知父页面手势结束（用于 POI 限流刷新）
      this.triggerEvent('gestureend', { scale });
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
      // console.log(`[TileDebug] scale=${scale.toFixed(2)} level=${level} z4=${z4Count} z6=${overlayCount}`)
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
            lx: c * logicalSize,
            ly: r * logicalSize,
            lsize: logicalSize
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
      const { offsetX, offsetY, scale, markers, huntingZones } = this.data

      // 标记位置
      let markersOnScreen = []
      if (markers && markers.length > 0) {
        markersOnScreen = markers.map(marker => {
          if (!marker.lng || !marker.lat) return null
          const pixelX = (marker.lng - GEO_BOUNDS.longitudeLeft) / (GEO_BOUNDS.longitudeRight - GEO_BOUNDS.longitudeLeft) * FULL_MAP_SIZE
          const pixelY = (marker.lat - GEO_BOUNDS.latitudeTop) / (GEO_BOUNDS.latitudeBottom - GEO_BOUNDS.latitudeTop) * FULL_MAP_SIZE
          return { ...marker, px: pixelX, py: pixelY, typeColor: MARKER_TYPE_COLORS[marker.type] || '' }
        }).filter(Boolean)
      }

      // 狩猎区裁剪与 LOD
      let huntingZonesOnScreen = []
      if (huntingZones && huntingZones.length > 0) {
        const vpLeft = -offsetX / scale
        const vpTop = -offsetY / scale
        const vpRight = (this._vw - offsetX) / scale
        const vpBottom = (this._vh - offsetY) / scale

        const lngRange = GEO_BOUNDS.longitudeRight - GEO_BOUNDS.longitudeLeft
        const latRange = GEO_BOUNDS.latitudeBottom - GEO_BOUNDS.latitudeTop

        let visible = []
        for (let i = 0; i < huntingZones.length; i++) {
          const z = huntingZones[i]
          const px = (z.x - GEO_BOUNDS.longitudeLeft) / lngRange * FULL_MAP_SIZE
          const py = (z.y - GEO_BOUNDS.latitudeTop) / latRange * FULL_MAP_SIZE
          const rpx = z.r / Math.abs(lngRange) * FULL_MAP_SIZE
          
          // 检查包围盒视口碰撞
          if (px + rpx > vpLeft && px - rpx < vpRight && py + rpx > vpTop && py - rpx < vpBottom) {
            visible.push({
              id: 'hz_' + i,
              px: px,
              py: py,
              rpx: rpx,
              color: z.color
            })
          }
        }
        
        // LOD 截断：最多渲染 200 个，防止小程序爆内存卡顿
        if (visible.length > 200) {
          visible = visible.slice(0, 200)
        }
        huntingZonesOnScreen = visible
      }

      // 瓦片数据（仅在变化时附带，不增加 setData 次数）
      const tileData = this._computeTileData()

      this.setData({ markersOnScreen, huntingZonesOnScreen, ...tileData, 'wxsState.trigger': Date.now() })
    },

    // ================================================================
    // 公共 API
    // ================================================================

    /** 强制重新测量容器尺寸并初始化地图 */
    resize(resetView = true) {
      wx.createSelectorQuery().in(this).select('.map-viewport').boundingClientRect(rect => {
        if (rect && rect.height > 0) {
          this._vw = rect.width
          this._vh = rect.height
          this._vpLeft = rect.left || 0
          this._vpTop = rect.top || 0
          if (resetView) {
            this._initMap()
          } else {
            MIN_SCALE = Math.min(this._vw / FULL_MAP_SIZE, this._vh / FULL_MAP_SIZE)
            if (this.data.scale < MIN_SCALE) this.data.scale = MIN_SCALE
            this._clampOffset()
            this.setData({
              _vw: this._vw,
              _vh: this._vh,
              scale: this.data.scale,
              offsetX: this.data.offsetX,
              offsetY: this.data.offsetY
            })
            this._syncWxsState()
            this._refreshOverlay()
          }
        }
      }).exec()
    },

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
      this._syncWxsState(true) // 强制打断可能的滑动惯性
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
      this._syncWxsState(true) // 强制打断可能的滑动惯性
      this._refreshOverlay()
    },

    /** 重新计算视口尺寸（底栏高度变化后调用） */
    recalcViewport(height, resetView = true) {
      if (height) this._vh = height
      if (resetView) {
        this._initMap()
      } else {
        MIN_SCALE = Math.min(this._vw / FULL_MAP_SIZE, this._vh / FULL_MAP_SIZE)
        if (this.data.scale < MIN_SCALE) this.data.scale = MIN_SCALE
        this._clampOffset()
        this.setData({
          _vw: this._vw,
          _vh: this._vh,
          scale: this.data.scale,
          offsetX: this.data.offsetX,
          offsetY: this.data.offsetY
        })
        this._syncWxsState()
        this._refreshOverlay()
      }
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
      const startScale = this.data.scale
      const startOX = this.data.offsetX
      const startOY = this.data.offsetY
      const finalOX = cx - (cx - startOX) * targetScale / startScale
      const finalOY = cy - (cy - startOY) * targetScale / startScale
      
      this.data.offsetX = finalOX
      this.data.offsetY = finalOY
      this.data.scale = targetScale
      this._clampOffset()
      
      this.setData({
        offsetX: this.data.offsetX,
        offsetY: this.data.offsetY,
        scale: this.data.scale
      })
      this._syncWxsState(true) // 强制打断可能的滑动惯性
      this._refreshOverlayAnim()
    },

    // ================================================================
    // 标记位置计算（内部实现）
    // ================================================================

    /** 初始化网格静态数据（仅调用一次） */
    _initGrid() {
      const gridLinesH = []
      const gridLinesV = []
      const gridLabels = []

      for (let i = 1; i < GRID_ROWS; i++) {
        gridLinesH.push({ id: 'h' + i, ly: i * GRID_CELL })
      }
      for (let j = 1; j < GRID_COLS; j++) {
        gridLinesV.push({ id: 'v' + j, lx: j * GRID_CELL })
      }
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          gridLabels.push({
            id: 'lbl_' + r + '_' + c,
            text: GRID_LABELS_ROW[r] + GRID_LABELS_COL[c],
            lx: c * GRID_CELL,
            ly: r * GRID_CELL
          })
        }
      }

      this.setData({ gridLinesH, gridLinesV, gridLabels })
    },

    /** 初始化安全区圆圈（游戏坐标 → 地图像素坐标，仅调用一次） */
    _initSafeZones() {
      const lngRange = GEO_BOUNDS.longitudeRight - GEO_BOUNDS.longitudeLeft  // 负值
      const latRange = GEO_BOUNDS.latitudeBottom - GEO_BOUNDS.latitudeTop    // 负值

      const zones = SAFE_ZONES.map(z => ({
        id: z.id,
        px: (z.lng - GEO_BOUNDS.longitudeLeft) / lngRange * FULL_MAP_SIZE,
        py: (z.lat - GEO_BOUNDS.latitudeTop) / latRange * FULL_MAP_SIZE,
        rpx: z.radius / Math.abs(lngRange) * FULL_MAP_SIZE
      }))
      this.setData({ safeZonesOnScreen: zones })
    },

    /** 实际执行标记位置更新（被 _updateMarkersScreenPos 和动画调用） */
    _doUpdateMarkersScreenPos() {
      this._refreshOverlayAnim()
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
      // console.log(`[TileLoad] ${id} level=${level} cached=${cached}`)
      // 如果是从网络加载的（未缓存），保存到本地
      if (level >= 4 && !cached) {
        this._saveTileToCache(level, c, r)
      }
    },

    /** 标记命中检测（由 WXS 单击回调触发） */
    onTapAtPoint(e) {
      const { x, y } = e  // clientX, clientY（屏幕坐标）
      const { offsetX, offsetY, scale, markersOnScreen } = this.data
      if (!markersOnScreen || markersOnScreen.length === 0) return

      // 屏幕坐标 → viewport 局部坐标
      const vpX = x - (this._vpLeft || 0)
      const vpY = y - (this._vpTop || 0)

      // 命中检测：反向遍历（z-index 高的优先）
      // 水滴锚点在底部尖端(my)，图标向上延伸约 34px（24px对角线 + border + shadow）
      // X 轴保持中心对称容差，Y 轴向上覆盖整个水滴区域
      const HIT_RADIUS_X = 15  // 水滴宽度容差（20px / 2 + 余量）
      const HIT_TOP = 28       // 水滴顶部距锚点的偏移（20px × √2 ≈ 28）
      let hitMarker = false
      for (let i = markersOnScreen.length - 1; i >= 0; i--) {
        const m = markersOnScreen[i]
        const mx = m.px * scale + offsetX
        const my = m.py * scale + offsetY
        if (Math.abs(vpX - mx) < HIT_RADIUS_X && vpY >= my - HIT_TOP && vpY <= my) {
          this.triggerEvent('markertap', { marker: m })
          hitMarker = true
          break
        }
      }

      // 如果没有点中任何标记，抛出地图被点击事件 (触发狩猎区雷达探测)
      if (!hitMarker) {
        // 先把屏幕坐标转成游戏坐标再抛出
        const geo = this.screenToGeo(x, y)
        this.triggerEvent('maptap', { x, y, geoLng: geo.lng, geoLat: geo.lat })
      }
    }
  }
})
