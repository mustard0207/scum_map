const app = getApp()

// POI 分类配置（直接使用 category-map.js）
const catMap = require('../../data/category-map.js')

// 按 section 分组，生成 WXML 可遍历的数组格式
const SECTION_CN = {
  'Bunkers': '地堡', 'Buildings': '建筑', 'Crops': '农作物',
  'Vehicles': '载具', 'Construction materials': '建筑材料',
  'Water sources': '水源', 'Points of interest': '兴趣点',
  'Quests': '任务', 'Radiation': '辐射', 'Loot containers': '战利品容器',
  'Outposts': '前哨站', '无分组': '未分类'
}
const SECTION_EMOJI = {
  'Bunkers': '💀', 'Buildings': '🏢', 'Crops': '🌾',
  'Vehicles': '🚗', 'Construction materials': '🧱',
  'Water sources': '💧', 'Points of interest': '📍',
  'Quests': '📋', 'Radiation': '☢️', 'Loot containers': '📦',
  'Outposts': '🏕️', '无分组': '📌'
}

// 构建 poiCategories 数组（供 WXML 遍历）
const poiCategories = []
const sectionMap = {}  // sectionName → { subs: { catId: {emoji, cnName} } }
for (const [catId, cat] of Object.entries(catMap)) {
  const section = cat.section
  if (!sectionMap[section]) {
    sectionMap[section] = { name: section, cnName: SECTION_CN[section] || section, emoji: SECTION_EMOJI[section] || '📌', subs: {} }
    poiCategories.push(sectionMap[section])
  }
  sectionMap[section].subs[catId] = { emoji: cat.emoji, cnName: cat.cnName }
}

// 构建 catId → emoji / cnName / section 查找表
const CAT_EMOJI = {}
const CAT_CN = {}
const CAT_SECTION = {}
for (const [catId, cat] of Object.entries(catMap)) {
  CAT_EMOJI[catId] = cat.emoji
  CAT_CN[catId] = cat.cnName
  CAT_SECTION[catId] = cat.section
}

// 精选大类（简化版筛选菜单中的可展开 section）
const QUICK_SECTIONS = ['Bunkers', 'Vehicles', 'Radiation']
// 精选直选小类
const QUICK_SUBS = ['10', '33', '8']  // 警局、药店、加油站

// 渲染限流常量
const MAX_POI_RENDER = 200        // 单次渲染 DOM 上限（防卡）
const MIN_SCREEN_DIST = 20        // 标记间最小屏幕距离（px），用于网格聚合
const SCALE_THRESHOLD = 3         // 放大到此倍数时关闭聚合，显示全部

// 自定义标记类型
const MARKER_TYPES = {
  house:   { emoji: '🏠', label: '房屋',   color: '#6BBF59' },
  vehicle: { emoji: '🚗', label: '载具',   color: '#6BBF59' },
  box:     { emoji: '📦', label: '储物箱', color: '#6BBF59' }
}

const VEHICLE_TYPES = [
  { id: 1, name: '拉各', icon: '🚚', parts: ['engine', 'battery', 'alternator', 'door_fl', 'door_fr', 'door_rl', 'door_rr', 'seat_fl', 'seat_fr'], wheelCount: 4, wheelBits: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] },
  { id: 2, name: '太众', icon: '🚗', parts: ['engine', 'battery', 'alternator', 'door_fl', 'door_fr', 'door_rl', 'door_rr', 'seat_fl', 'seat_fr'], wheelCount: 4, wheelBits: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] },
  { id: 3, name: '莱卡', icon: '🚙', parts: ['engine', 'battery', 'alternator', 'door_fl', 'door_fr', 'seat_fl', 'seat_fr'], wheelCount: 4, wheelBits: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] },
  { id: 4, name: 'RIS', icon: '🏎️', parts: ['engine', 'battery', 'body'], wheelCount: 4, wheelBits: ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'] },
  { id: 5, name: '三轮摩托', icon: '🛵', parts: ['engine', 'battery', 'seat_f', 'seat_r'], wheelCount: 3, wheelBits: ['wheel_f', 'wheel_rl', 'wheel_rr'] },
  { id: 6, name: '巡航摩托', icon: '🏍️', parts: ['engine', 'battery', 'wheel_f', 'wheel_r', 'seat_f', 'seat_r'] },
  { id: 7, name: '越野摩托', icon: '🏍️', parts: ['engine', 'battery', 'wheel_f', 'wheel_r', 'seat_f', 'seat_r', 'body'] },
  { id: 8, name: '山地单车', icon: '🚲', parts: [], wheelCount: 2, wheelBits: ['wheel_f', 'wheel_r'] },
  { id: 9, name: '城市单车', icon: '🚲', parts: [], wheelCount: 2, wheelBits: ['wheel_f', 'wheel_r'] },
  { id: 10, name: '手推车', icon: '🛒', parts: [] },
  { id: 11, name: '摩托艇', icon: '🚤', parts: [] },
  { id: 12, name: '木船', icon: '⛵', parts: [] },
  { id: 13, name: '飞机', icon: '✈️', parts: [] },
  { id: 14, name: '拖拉机', icon: '🚜', parts: ['engine', 'battery', 'alternator'], wheelCount: 2, wheelBits: ['wheel_fl', 'wheel_fr'] }
]

const PART_BITS = {
  engine: 1, battery: 2, alternator: 4,
  door_fl: 8, door_fr: 16, door_rl: 32, door_rr: 64,
  wheel_fl: 128, wheel_fr: 256, wheel_rl: 512, wheel_rr: 1024,
  wheel_f: 2048, wheel_r: 4096,
  seat_fl: 8192, seat_f: 8192,
  seat_fr: 16384, seat_r: 16384,
  body: 32768
}

// 用户标记数量上限（与 POI 标记独立计数）
const USER_MARKER_LIMIT = 100

// 自定义标记筛选类型（用于筛选面板）
const USER_MARKER_FILTER_TYPES = [
  { id: 'none',    emoji: '📌', cnName: '无类型' },
  { id: 'house',   emoji: '🏠', cnName: '房屋' },
  { id: 'vehicle', emoji: '🚗', cnName: '载具' },
  { id: 'box',     emoji: '📦', cnName: '储物箱' }
]

// 标记过期天数默认配置（0 = 永不过期）
const MARKER_EXPIRY_DAYS = {
  '': 0,        // 无类型 — 不过期
  house: 15,    // 房屋 — 15天
  vehicle: 10,  // 载具 — 10天
  box: 15       // 储物箱 — 15天
}

// 游戏坐标范围（与 tile-map 组件一致）
const GEO_LNG_LEFT = 619200
const GEO_LNG_RIGHT = -904800
const GEO_LAT_TOP = 619199.938
const GEO_LAT_BOTTOM = -904800
const FULL_MAP = 1280

Page({
  data: {
    statusBarHeight: 0,
    bottomBarHeight: 0,
    coordLng: 0,
    coordLat: 0,
    showGuide: false,
    showCoordInput: false,
    coordInputValue: '',
    zoomSliderPercent: 0,  // 缩放条位置百分比（0=底部最小，100=顶部最大）
    // 标记数组（传给组件）
    markers: [],
    // 当前选中的标记
    selectedMarker: null,
    selectedMarkerIndex: -1,
    // 信息窗口
    showInfoWindow: false,
    // 导入弹窗
    showImportDialog: false,
    importInputValue: '',
    // 备份抽屉
    showDataDrawer: false,
    // 分享视图
    showSaveBanner: false,
    showSaveConfirm: false,
    // POI 筛选
    poiCategories: poiCategories,   // 分类配置（按 section 分组）
    activePoiCats: [],              // 当前激活的小类 ID（默认无，安全区已有绿圈显示）
    poiCatCounts: {},               // 每个小类的点位数 { catId: number }
    poiGroupCounts: {},             // 每个大类的小类数 { sectionName: number }
    sectionSelectedCounts: {},      // 每个大类的选中小类数 { sectionName: number }
    quickSections: QUICK_SECTIONS,  // 精选 section 名
    quickSubs: QUICK_SUBS.map(id => ({ id, emoji: CAT_EMOJI[id], cnName: CAT_CN[id] })),
    quickCategories: poiCategories.filter(c => QUICK_SECTIONS.includes(c.name)),
    activePoiMap: {},               // 活跃分类查找表 { catId: true }
    showFilterPanel: false,         // 筛选面板开关
    filterFullMode: false,          // 完整版筛选模式
    expandedGroups: {},             // 展开的大类
    poiCatName: '',                 // 当前选中 POI 的小类名
    showVehiclePartsEditor: false,  // 是否展开载具配件编辑面板
    markerTypes: MARKER_TYPES,      // 自定义标记类型配置
    vehicleTypes: VEHICLE_TYPES,    // 载具类型配置
    partBits: PART_BITS,            // 载具配件位掩码映射
    // 自定义标记类型筛选
    userMarkerFilterTypes: USER_MARKER_FILTER_TYPES,
    showUserMarkers: true,          // 大类总开关
    activeUserMarkerTypes: ['none', 'house', 'vehicle', 'box'],  // 默认全选
    activeUserMarkerMap: { none: true, house: true, vehicle: true, box: true },
    userMarkerTypeCounts: {},       // { 'none': 3, 'house': 2, ... } 各类型标记数量
    // 维护系统
    markerExpiryDaysConfig: { ...MARKER_EXPIRY_DAYS },  // 过期天数配置（可修改）
    markerCreatedAtText: '',        // 选中标记的放置时间文本
    markerCreatedAtDate: '',        // 选中标记的放置日期（YYYY-MM-DD，用于 picker）
    selectedMarkerExpiryDays: 0,    // 选中标记的过期天数
    selectedMarkerRemainingDays: 0, // 选中标记的剩余天数
    markerRemainingDaysText: '',    // 选中标记的剩余天数文本
    showExpirySettings: false,      // 过期设置弹窗开关
    tempExpiryDays: {},             // 过期设置弹窗临时数据
    tempWarnDays: 2,                // 弹窗中的最小提醒天数临时值
    markerWarnDays: 2,              // 最小剩余天数（低于此值显示警告）
  },

  onLoad(options) {
    this._allUserMarkers = []  // 用户标记持久化数据源（不受筛选影响）
    const sysInfo = wx.getWindowInfo()
    if (sysInfo) this.setData({ statusBarHeight: sysInfo.statusBarHeight })

    // 首次引导检查
    if (!wx.getStorageSync('hasSeenGuide')) {
      this.setData({ showGuide: true })
    }

    // 预计算每个大类的小类数量
    const poiGroupCounts = {}
    poiCategories.forEach(section => {
      poiGroupCounts[section.name] = Object.keys(section.subs).length
    })
    poiGroupCounts['_custom'] = USER_MARKER_FILTER_TYPES.length
    this.setData({ poiGroupCounts })
    this._updateSectionSelectedCounts()

    // 预加载默认前哨站数据（catId=80 → Points of interest section）
    this._getSectionData('Points of interest')

    // POI 刷新由 onMapReady → _schedulePoiRefresh 触发，此处不提前调用

    setTimeout(() => {
      const query = wx.createSelectorQuery()
      query.select('#bottomBar').boundingClientRect(rect => {
        if (rect) {
          this.setData({ bottomBarHeight: rect.height })
          // 计算 map-area 实际高度并传给组件
          const sysInfo = wx.getWindowInfo()
          if (!sysInfo) return
          const navBarH = this.data.statusBarHeight + 44
          const mapH = sysInfo.windowHeight - navBarH - rect.height
          console.log(`[LayoutDebug] bottomBar: h=${rect.height} top=${rect.top} bottom=${rect.bottom} mapH=${mapH}`)
          this.selectComponent('#tileMap').recalcViewport(mapH)
        }
      }).exec()
    }, 100)

    // 接收分享链接跳转参数
    const isShareLink = !!(options.markers || (options.x && options.y))
    let shareLatLng = null

    if (options.markers) {
      // 新格式：多个标记 markers=lng1,lat1,name1,type1,createdAt,vid,mask|...
      const sharedMarkers = options.markers.split('|').map((item, i) => {
        const parts = item.split(',')
        const type = parts[3] || ''
        const typeConf = MARKER_TYPES[type]
        const createdAt = parseInt(parts[4]) || Math.floor(Date.now() / 1000)
        let vehicleId = 0
        let partsMask = 0xFFFF
        let emoji = typeConf ? typeConf.emoji : ''
        if (type === 'vehicle' && parts.length >= 7) {
          vehicleId = parseInt(parts[5]) || 1
          partsMask = parseInt(parts[6])
          if (isNaN(partsMask)) partsMask = 0xFFFF
          const vehicle = VEHICLE_TYPES.find(v => v.id === vehicleId)
          if (vehicle && vehicle.icon) emoji = vehicle.icon
        }
        return {
          id: 'shared_' + Date.now() + '_' + i,
          lng: parseFloat(parts[0]),
          lat: parseFloat(parts[1]),
          name: parts[2] ? decodeURIComponent(parts[2]) : '',
          type,
          vehicleId,
          partsMask,
          emoji,
          createdAt
        }
      }).filter(m => !isNaN(m.lng) && !isNaN(m.lat))
      if (sharedMarkers.length > 0) {
        this._allUserMarkers = sharedMarkers
        this.setData({ markers: sharedMarkers })
        shareLatLng = sharedMarkers[sharedMarkers.length - 1]
      }
    } else if (options.x && options.y) {
      // 旧格式兼容：单个标记 x=lng&y=lat&name=xxx
      const lng = parseFloat(options.x)
      const lat = parseFloat(options.y)
      const name = decodeURIComponent(options.name || '')
      const marker = { id: 'shared_' + Date.now(), lng, lat, name, type: '' }
      this._allUserMarkers = [marker]
      this.setData({
        markers: [marker],
        selectedMarker: marker
      })
      shareLatLng = marker
    }

    // POI 筛选分类 poiCats=80,10,33
    if (options.poiCats) {
      const catIds = options.poiCats.split(',').filter(id => id.trim() !== '')
      if (catIds.length > 0) {
        const activePoiMap = {}
        catIds.forEach(id => { activePoiMap[id] = true })
        this.setData({ activePoiCats: catIds, activePoiMap })
        this._poiPixelCache = null
        setTimeout(() => this._schedulePoiRefresh(), 300)
      }
    }

    // 过期配置 exp=none,house,vehicle,box,warnDays
    if (options.exp) {
      const expParts = options.exp.split(',').map(Number)
      if (expParts.length >= 4) {
        const config = { '': expParts[0] || 0, house: expParts[1] || 0, vehicle: expParts[2] || 0, box: expParts[3] || 0 }
        const warnDays = expParts[4] >= 0 ? expParts[4] : 2
        this.setData({ markerExpiryDaysConfig: config, markerWarnDays: warnDays })
      }
    }

    // 分享链接：标记为临时查看，不自动保存
    if (isShareLink) {
      this._isSharedView = true
      this.setData({ showSaveBanner: true })
    } else {
      // 正常打开：从本地存储恢复
      this._isSharedView = false
      this._loadFromStorage()
    }

    // 跳转到最后一个标记的位置
    if (shareLatLng) {
      setTimeout(() => this.navigateToTarget(shareLatLng.lng, shareLatLng.lat), 600)
    }
  },

  onShow() {
    // 启动坐标实时刷新（十字光标所在位置的坐标）
    this._coordTimer = setInterval(() => this._refreshCenterCoord(), 200)

    // 激活分享能力（必须先调用，wx.shareAppMessage 才能正常工作）
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
  },

  onHide() {
    clearInterval(this._coordTimer)
  },

  onUnload() {
    clearInterval(this._coordTimer)
    if (this._poiRefreshTimer) clearTimeout(this._poiRefreshTimer)
    this.setData({ showImportDialog: false, showDataDrawer: false, showFilterPanel: false })
  },

  /** DEBUG: 检测点击位置 */
  onMapAreaTap(e) {
    const { clientX, clientY } = e.detail
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return
    const screenH = sysInfo.windowHeight
    console.log(`[TapDebug] x=${clientX} y=${clientY} screenH=${screenH} bottomBarH=${this.data.bottomBarHeight} distFromBottom=${screenH - clientY}`)
  },

  // ================================================================
  // 缩放拖拉条
  // ================================================================

  onZoomSliderStart(e) {
    this._sliderStartY = e.touches[0].clientY
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) {
      this._sliderStartScale = mapComp.getScale()
      this._sliderMinScale = mapComp.getMinScale()
    }
  },

  onZoomSliderMove(e) {
    if (this._sliderStartY === undefined) return
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return

    const minScale = this._sliderMinScale || 0.2
    const maxScale = 8
    const dy = this._sliderStartY - e.touches[0].clientY  // 上拉为正
    const sliderRange = 300  // 拖拉条有效像素范围（条越长精度越高）
    const scaleDelta = (dy / sliderRange) * (maxScale - minScale)
    const newScale = Math.max(minScale, Math.min(maxScale, this._sliderStartScale + scaleDelta))

    // 以十字光标（屏幕中心）为锚点缩放
    const cx = sysInfo.windowWidth / 2
    const cy = sysInfo.windowHeight / 2
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) mapComp.zoomTo(newScale, cx, cy)

    // 更新滑块位置
    const percent = ((newScale - minScale) / (maxScale - minScale)) * 100
    this.setData({ zoomSliderPercent: Math.max(0, Math.min(100, percent)) })
  },

  onZoomSliderEnd() {
    this._sliderStartY = undefined
    this._sliderStartScale = undefined
    this._schedulePoiRefresh()
  },

  /** 刷新屏幕中心光标处的地理坐标 */
  _refreshCenterCoord() {
    const mapComp = this.selectComponent('#tileMap')
    if (!mapComp) return

    // 使用地图视口的中心坐标（相对于地图视口）
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return
    const mapViewportHeight = sysInfo.windowHeight - this.data.statusBarHeight - 44 - 70  // 减去状态栏、导航栏、底部栏
    const cx = sysInfo.windowWidth / 2
    const cy = mapViewportHeight / 2

    const geo = mapComp.screenToGeo(cx, cy)
    if (geo) {
      // 同步缩放条位置
      const scale = mapComp.getScale()
      const minScale = mapComp.getMinScale()
      const percent = ((scale - minScale) / (8 - minScale)) * 100
      this.setData({
        coordLng: geo.lng,
        coordLat: geo.lat,
        zoomSliderPercent: Math.max(0, Math.min(100, percent))
      })
    }
  },

  /** 点击"选点"：将当前十字光标位置标记为选中点 */
  placeMarker() {
    if (this._allUserMarkers.length >= USER_MARKER_LIMIT) {
      wx.showToast({ title: `最多支持${USER_MARKER_LIMIT}个标记`, icon: 'none' })
      return
    }
    const mapComp = this.selectComponent('#tileMap')
    if (!mapComp) return

    // 使用地图视口的中心坐标
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return
    const mapViewportHeight = sysInfo.windowHeight - this.data.statusBarHeight - 44 - 70
    const cx = sysInfo.windowWidth / 2
    const cy = mapViewportHeight / 2

    const geo = mapComp.screenToGeo(cx, cy)
    if (geo) {
      const newMarker = {
        id: 'user_' + Date.now(),
        lng: geo.lng,
        lat: geo.lat,
        name: '',
        type: '',
        vehicleId: 0,
        partsMask: 0xFFFF,
        createdAt: Math.floor(Date.now() / 1000)
      }
      this._allUserMarkers.push(newMarker)
      this._rebuildDisplayMarkers()
      this.setData({
        selectedMarker: newMarker,
        selectedMarkerIndex: -1,
        showInfoWindow: false
      })
      wx.vibrateShort({ type: 'medium' })
      this._onUserChange()
    }
  },

  /** 显示坐标输入框 */
  showCoordInput() {
    this.setData({ showCoordInput: true, coordInputValue: '' })
  },

  /** 隐藏坐标输入框 */
  hideCoordInput() {
    this.setData({ showCoordInput: false })
  },

  /** 空方法：阻止事件冒泡（用于 catchtap） */
  noop() {},

  /** 坐标输入框内容变化 */
  onCoordInputChange(e) {
    this.setData({ coordInputValue: e.detail.value })
  },

  /** 跳转到输入的坐标 */
  jumpToCoord() {
    if (this._allUserMarkers.length >= USER_MARKER_LIMIT) {
      wx.showToast({ title: `最多支持${USER_MARKER_LIMIT}个标记`, icon: 'none' })
      return
    }
    const input = this.data.coordInputValue
    console.log('jumpToCoord input:', input)
    if (!input) {
      wx.showToast({ title: '请输入坐标', icon: 'none' })
      return
    }

    const coord = this._parseCoordInput(input)
    console.log('jumpToCoord parsed:', coord)
    if (!coord) {
      wx.showToast({ title: '坐标格式错误', icon: 'none' })
      return
    }

    const mapComp = this.selectComponent('#tileMap')
    console.log('mapComp:', mapComp)
    if (!mapComp) return

    // 检查坐标是否在范围内
    const inBounds = mapComp.isInBounds(coord.lng, coord.lat)
    console.log('inBounds:', inBounds)
    if (!inBounds) {
      wx.showToast({ title: '坐标超出地图范围', icon: 'none' })
      return
    }

    // 跳转到坐标并添加标记
    const success = mapComp.moveToGeo(coord.lng, coord.lat)
    console.log('moveToGeo success:', success)
    if (success) {
      const newMarker = {
        id: 'input_' + Date.now(),
        lng: coord.lng,
        lat: coord.lat,
        name: '',
        type: '',
        vehicleId: 0,
        partsMask: 0xFFFF,
        createdAt: Math.floor(Date.now() / 1000)
      }
      this._allUserMarkers.push(newMarker)
      this._rebuildDisplayMarkers()
      this.setData({
        selectedMarker: newMarker,
        selectedMarkerIndex: -1,
        showInfoWindow: false,
        showCoordInput: false
      })
      this._schedulePoiRefresh()
      wx.vibrateShort({ type: 'medium' })
      this._onUserChange()
    }
  },

  /** 解析坐标输入 */
  _parseCoordInput(input) {
    // 格式1：游戏原始格式 {X=19079.908 Y=-687946.000 Z=873.744|...}
    const gameFormat = input.match(/X=\s*([-\d.]+)\s+Y=\s*([-\d.]+)/i)
    if (gameFormat) {
      return {
        lng: parseFloat(gameFormat[1]),
        lat: parseFloat(gameFormat[2])
      }
    }

    // 格式2：简单格式 19079.908, -687946.000 或 19079.908 -687946.000
    const simpleFormat = input.match(/([-\d.]+)\s*[,\s]\s*([-\d.]+)/)
    if (simpleFormat) {
      return {
        lng: parseFloat(simpleFormat[1]),
        lat: parseFloat(simpleFormat[2])
      }
    }

    return null
  },

  /** 标记点击事件 */
  onMarkerTap(e) {
    const marker = e.detail.marker
    if (marker) {
      // 计算该标记在用户自定义标记中的排位（跳过 POI）
      const userMarkers = this.data.markers.filter(m => m.src !== 'poi')
      const userIdx = userMarkers.findIndex(m => m.id === marker.id)
      const setData = {
        selectedMarker: marker,
        selectedMarkerIndex: userIdx,
        showInfoWindow: true,
        showVehiclePartsEditor: marker.type === 'vehicle' && marker.partsMask !== undefined && marker.partsMask !== 65535
      }
      // POI 标记显示小类名
      if (marker.src === 'poi' && marker.cat) {
        setData.poiCatName = this._getPoiCatName(marker.cat)
      }
      this.setData(setData)
      this._updateInfoWindowExpiry()
    }
  },

  /** 关闭信息窗口 */
  closeInfoWindow() {
    this.setData({ showInfoWindow: false, selectedMarker: null, selectedMarkerIndex: -1 })
  },

  /** 复制当前选中标记的坐标 */
  copyCoord() {
    const marker = this.data.selectedMarker
    if (!marker) return
    wx.setClipboardData({
      data: `{X=${marker.lng} Y=${marker.lat} Z=0}`,
      success: () => wx.showToast({ title: '坐标已复制' })
    })
  },

  /** 设置自定义标记类型 */
  setMarkerType(e) {
    const type = e.currentTarget.dataset.type
    const marker = this.data.selectedMarker
    if (!marker) return
    // 点击已选中的类型则取消
    const newType = marker.type === type ? '' : type
    const typeConf = MARKER_TYPES[newType]
    const update = { type: newType, emoji: typeConf ? typeConf.emoji : '' }
    // 如果是切换为载具，初始化 vehicleId 并覆盖专用图标
    if (newType === 'vehicle') {
      update.vehicleId = marker.vehicleId || 1
      update.partsMask = marker.partsMask !== undefined ? marker.partsMask : 0xFFFF
      const vehicle = VEHICLE_TYPES.find(v => v.id === update.vehicleId)
      if (vehicle && vehicle.icon) update.emoji = vehicle.icon
    }
    // 更新 _allUserMarkers
    const idx = this._allUserMarkers.findIndex(m => m.id === marker.id)
    if (idx >= 0) this._allUserMarkers[idx] = { ...this._allUserMarkers[idx], ...update }
    this._rebuildDisplayMarkers()
    this.setData({
      selectedMarker: { ...marker, ...update }
    })
    this._updateInfoWindowExpiry()
    this._onUserChange()
  },

  /** 切换载具种类 */
  onVehicleTypeChange(e) {
    const marker = this.data.selectedMarker
    if (!marker || marker.type !== 'vehicle') return
    const vehicleId = parseInt(e.currentTarget.dataset.id)
    const update = { vehicleId, partsMask: 0xFFFF } // 重置部件状态为满配
    const vehicle = VEHICLE_TYPES.find(v => v.id === vehicleId)
    if (vehicle && vehicle.icon) {
      update.emoji = vehicle.icon
    }
    const idx = this._allUserMarkers.findIndex(m => m.id === marker.id)
    if (idx >= 0) this._allUserMarkers[idx] = { ...this._allUserMarkers[idx], ...update }
    this._rebuildDisplayMarkers()
    this.setData({ selectedMarker: { ...marker, ...update } })
    this._onUserChange()
  },

  /** 切换载具特定部件状态 */
  toggleVehiclePart(e) {
    const marker = this.data.selectedMarker
    if (!marker || marker.type !== 'vehicle') return
    const partName = e.currentTarget.dataset.part
    const partBit = PART_BITS[partName]
    if (!partBit) return
    const currentMask = marker.partsMask !== undefined ? marker.partsMask : 0xFFFF
    // 异或运算切换对应位
    const newMask = currentMask ^ partBit
    const update = { partsMask: newMask }
    const idx = this._allUserMarkers.findIndex(m => m.id === marker.id)
    if (idx >= 0) this._allUserMarkers[idx] = { ...this._allUserMarkers[idx], ...update }
    this._rebuildDisplayMarkers()
    this.setData({ selectedMarker: { ...marker, ...update } })
    this._onUserChange()
  },

  /** 增减车轮数量 */
  changeWheelCount(e) {
    const marker = this.data.selectedMarker
    if (!marker || marker.type !== 'vehicle') return
    const delta = parseInt(e.currentTarget.dataset.delta)
    const vehicle = VEHICLE_TYPES.find(v => v.id === (marker.vehicleId || 1))
    if (!vehicle || !vehicle.wheelBits) return

    let currentMask = marker.partsMask !== undefined ? marker.partsMask : 0xFFFF
    
    if (delta > 0) {
      // 增加轮子：找到一个当前为 0 的 bit 并将其设为 1
      for (let bitName of vehicle.wheelBits) {
        const bit = PART_BITS[bitName]
        if ((currentMask & bit) === 0) {
          currentMask |= bit
          break
        }
      }
    } else if (delta < 0) {
      // 减少轮子：找到一个当前为 1 的 bit 并将其清零
      for (let bitName of vehicle.wheelBits) {
        const bit = PART_BITS[bitName]
        if ((currentMask & bit) !== 0) {
          currentMask &= ~bit
          break
        }
      }
    }

    const update = { partsMask: currentMask }
    const idx = this._allUserMarkers.findIndex(m => m.id === marker.id)
    if (idx >= 0) this._allUserMarkers[idx] = { ...this._allUserMarkers[idx], ...update }
    this._rebuildDisplayMarkers()
    this.setData({ selectedMarker: { ...marker, ...update } })
    this._onUserChange()
  },

  /** 展开载具配件编辑面板 */
  openVehiclePartsEditor() {
    this.setData({ showVehiclePartsEditor: true })
  },

  /** 恢复载具完整状态并折叠面板 */
  resetVehicleParts() {
    const marker = this.data.selectedMarker
    if (!marker || marker.type !== 'vehicle') return
    const update = { partsMask: 0xFFFF }
    const idx = this._allUserMarkers.findIndex(m => m.id === marker.id)
    if (idx >= 0) this._allUserMarkers[idx] = { ...this._allUserMarkers[idx], ...update }
    this._rebuildDisplayMarkers()
    this.setData({ 
      selectedMarker: { ...marker, ...update },
      showVehiclePartsEditor: false 
    })
    this._onUserChange()
  },

  /** 修改放置日期（保留原有时分秒） */
  onCreatedAtDateChange(e) {
    const marker = this.data.selectedMarker
    if (!marker || marker.src === 'poi' || !marker.createdAt) return
    const dateStr = e.detail.value // YYYY-MM-DD
    const [year, month, day] = dateStr.split('-').map(Number)
    const old = new Date(marker.createdAt * 1000)
    const newDate = new Date(year, month - 1, day, old.getHours(), old.getMinutes(), old.getSeconds())
    const newCreatedAt = Math.floor(newDate.getTime() / 1000)
    const idx = this._allUserMarkers.findIndex(m => m.id === marker.id)
    if (idx >= 0) this._allUserMarkers[idx] = { ...this._allUserMarkers[idx], createdAt: newCreatedAt }
    this._rebuildDisplayMarkers()
    this.setData({ selectedMarker: { ...marker, createdAt: newCreatedAt } })
    this._updateInfoWindowExpiry()
    this._onUserChange()
  },

  /** 刷新有效期按钮 */
  maintainMarker() {
    const marker = this.data.selectedMarker
    if (!marker || marker.src === 'poi') return
    const now = Math.floor(Date.now() / 1000)
    const idx = this._allUserMarkers.findIndex(m => m.id === marker.id)
    if (idx >= 0) this._allUserMarkers[idx] = { ...this._allUserMarkers[idx], createdAt: now }
    this._rebuildDisplayMarkers()
    this.setData({ selectedMarker: { ...marker, createdAt: now } })
    this._updateInfoWindowExpiry()
    this._onUserChange()
    wx.vibrateShort({ type: 'medium' })
    wx.showToast({ title: '有效期已刷新' })
  },

  /** 打开过期设置弹窗 */
  showExpirySettings() {
    this._tempExpiryDays = { ...this.data.markerExpiryDaysConfig }
    this._tempWarnDays = this.data.markerWarnDays
    this.setData({ showExpirySettings: true, tempExpiryDays: { ...this._tempExpiryDays }, tempWarnDays: this._tempWarnDays })
  },

  /** 关闭过期设置弹窗 */
  hideExpirySettings() {
    this.setData({ showExpirySettings: false })
  },

  /** 过期天数输入 */
  onExpiryDaysInput(e) {
    const type = e.currentTarget.dataset.type
    const val = parseInt(e.detail.value) || 0
    this._tempExpiryDays[type] = Math.max(0, val)
  },

  /** 最小提醒天数输入 */
  onWarnDaysInput(e) {
    this._tempWarnDays = Math.max(0, parseInt(e.detail.value) || 0)
  },

  /** 保存过期设置 */
  saveExpirySettings() {
    this.setData({
      markerExpiryDaysConfig: { ...this._tempExpiryDays },
      markerWarnDays: this._tempWarnDays,
      showExpirySettings: false
    })
    this._rebuildDisplayMarkers()
    this._updateInfoWindowExpiry()
    this._onUserChange()
    wx.showToast({ title: '过期设置已保存' })
  },

  /** 删除当前选中的标记 */
  deleteMarker() {
    if (!this.data.selectedMarker) return
    const markerId = this.data.selectedMarker.id
    this._allUserMarkers = this._allUserMarkers.filter(m => m.id !== markerId)
    this._rebuildDisplayMarkers()
    this.setData({
      selectedMarker: null,
      selectedMarkerIndex: -1,
      showInfoWindow: false
    })
    this._onUserChange()
  },

  /** 重置视图（含清除标记） */
  resetView() {
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) mapComp.resetView()
    this._allUserMarkers = []
    this.setData({ markers: [], selectedMarker: null, selectedMarkerIndex: -1, showInfoWindow: false })
    this._onUserChange()
  },

  /** 仅重置地图视角（保留标记） */
  resetMapView() {
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) {
      mapComp.resetView()
      this._schedulePoiRefresh()
    }
  },

  // ========== 导入导出（二进制紧凑格式） ==========

  /** 字符串 → UTF-8 字节数组 */
  _strToBytes(str) {
    const uri = encodeURIComponent(str)
    const bytes = []
    for (let i = 0; i < uri.length; i++) {
      if (uri[i] === '%') {
        bytes.push(parseInt(uri.substr(i + 1, 2), 16))
        i += 2
      } else {
        bytes.push(uri.charCodeAt(i))
      }
    }
    return bytes
  },

  /** UTF-8 字节数组 → 字符串 */
  _bytesToStr(bytes) {
    let uri = ''
    for (let i = 0; i < bytes.length; i++) {
      uri += '%' + ('0' + bytes[i].toString(16)).slice(-2)
    }
    return decodeURIComponent(uri)
  },

  /** 写入有符号 40 位整数（5 字节，小端序） */
  _writeInt40(bytes, value) {
    let v = Math.round(value)
    const sign = v < 0 ? 1 : 0
    if (v < 0) v = -v
    const lo32 = v >>> 0
    const hi8 = ((v / 0x100000000) >>> 0) & 0x7F
    bytes.push((lo32) & 0xFF)
    bytes.push((lo32 >> 8) & 0xFF)
    bytes.push((lo32 >> 16) & 0xFF)
    bytes.push((lo32 >> 24) & 0xFF)
    bytes.push(hi8 | (sign ? 0x80 : 0))
  },

  /** 读取有符号 40 位整数 */
  _readInt40(bytes, offset) {
    const b0 = bytes[offset]
    const b1 = bytes[offset + 1]
    const b2 = bytes[offset + 2]
    const b3 = bytes[offset + 3]
    const b4 = bytes[offset + 4]
    const lo32 = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    const hi8 = b4 & 0x7F
    const sign = (b4 & 0x80) ? -1 : 1
    const value = sign * (hi8 * 0x100000000 + (lo32 >>> 0))
    return value
  },

  /** Zigzag 编码：有符号 → 无符号（支持超出 32 位） */
  _zigzagEncode(value) {
    return value >= 0 ? value * 2 : value * -2 - 1
  },

  /** Zigzag 解码：无符号 → 有符号（支持超出 32 位） */
  _zigzagDecode(value) {
    return (value & 1) === 0 ? value / 2 : -(value + 1) / 2
  },

  /** 写入无符号 varint（7 位/字节，小端序，支持超出 32 位） */
  _writeVarint(bytes, value) {
    let v = Math.floor(value)
    while (v > 0x7F) {
      bytes.push((v & 0x7F) | 0x80)
      v = Math.floor(v / 128)
    }
    bytes.push(v & 0x7F)
  },

  /** 读取无符号 varint，返回 [值, 消耗字节数]（支持超出 32 位） */
  _readVarint(bytes, offset) {
    let result = 0
    let factor = 1
    let pos = offset
    while (pos < bytes.length) {
      const b = bytes[pos]
      result += (b & 0x7F) * factor
      pos++
      if ((b & 0x80) === 0) break
      factor *= 128
    }
    return [result, pos - offset]
  },

  /**
   * 编码标记为二进制紧凑格式
   * 版本 0x55：'U' + count(1B) + 绝对坐标(10B) + 偏移(varint) + name + type + createdAt
   * 版本 0x56：'V' 同上，若 type===2 则追加 1B vehicleId + 2B partsMask
   * 坐标精度：4 位小数（×10000）
   * 前缀：SCUM#
   */
  _encodeMarkers(markers) {
    const bytes = []
    bytes.push(0x56) // 'V' — 版本 0x56
    bytes.push(markers.length & 0xFF)

    for (let i = 0; i < markers.length; i++) {
      const m = markers[i]
      const lngInt = Math.round(m.lng * 10000)
      const latInt = Math.round(m.lat * 10000)

      if (i === 0) {
        // 第 1 个标记：绝对坐标
        this._writeInt40(bytes, lngInt)
        this._writeInt40(bytes, latInt)
      } else {
        // 后续标记：偏移量 zigzag + varint
        const prev = markers[i - 1]
        const dLng = lngInt - Math.round(prev.lng * 10000)
        const dLat = latInt - Math.round(prev.lat * 10000)
        this._writeVarint(bytes, this._zigzagEncode(dLng))
        this._writeVarint(bytes, this._zigzagEncode(dLat))
      }

      // 名字：长度前缀 + UTF-8
      const nameBytes = this._strToBytes(m.name || '')
      this._writeVarint(bytes, nameBytes.length)
      for (let j = 0; j < nameBytes.length; j++) bytes.push(nameBytes[j])

      // 类型：1 字节 (0x00=无, 0x01=house, 0x02=vehicle, 0x03=box)
      const typeCode = m.type === 'house' ? 1 : m.type === 'vehicle' ? 2 : m.type === 'box' ? 3 : 0
      bytes.push(typeCode)

      // createdAt：4 字节 uint32
      const ts = m.createdAt || 0
      bytes.push((ts >>> 24) & 0xFF)
      bytes.push((ts >>> 16) & 0xFF)
      bytes.push((ts >>> 8) & 0xFF)
      bytes.push(ts & 0xFF)
      
      // 如果是载具且版本为 0x56，追加载具扩展数据
      if (typeCode === 2) {
        const vid = m.vehicleId || 0
        bytes.push(vid & 0xFF)
        const mask = m.partsMask !== undefined ? m.partsMask : 0xFFFF
        bytes.push((mask >>> 8) & 0xFF)
        bytes.push(mask & 0xFF)
      }
    }

    const ab = new ArrayBuffer(bytes.length)
    const view = new Uint8Array(ab)
    for (let i = 0; i < bytes.length; i++) view[i] = bytes[i]
    return 'SCUM#' + wx.arrayBufferToBase64(ab)
  },

  /**
   * 解码标记（支持新二进制格式 + 旧文本格式）
   */
  _decodeMarkers(code) {
    if (!code || !code.startsWith('SCUM#')) return null
    try {
      const payload = code.substring(5)
      const ab = wx.base64ToArrayBuffer(payload)
      const bytes = new Uint8Array(ab)

      // 检查是否为二进制格式（0x53=旧版 / 0x54=含类型 / 0x55=含类型+createdAt / 0x56=含载具信息）
      if (bytes.length > 1 && (bytes[0] >= 0x53 && bytes[0] <= 0x56)) {
        return this._decodeBinaryMarkers(bytes, bytes[0] >= 0x54, bytes[0] >= 0x55, bytes[0] >= 0x56)
      }

      // 回退：旧文本格式
      return this._decodeTextMarkers(bytes)
    } catch (e) {
      return null
    }
  },

  /** 解码二进制格式标记 */
  _decodeBinaryMarkers(bytes, hasType, hasCreatedAt, hasVehicleParts) {
    const count = bytes[1]
    if (count === 0) return []
    const markers = []
    let pos = 2
    let prevLngInt = 0
    let prevLatInt = 0
    const typeMap = { 1: 'house', 2: 'vehicle', 3: 'box' }

    for (let i = 0; i < count && pos < bytes.length; i++) {
      let lngInt, latInt

      if (i === 0) {
        lngInt = this._readInt40(bytes, pos); pos += 5
        latInt = this._readInt40(bytes, pos); pos += 5
      } else {
        const [dLngRaw, c1] = this._readVarint(bytes, pos); pos += c1
        const [dLatRaw, c2] = this._readVarint(bytes, pos); pos += c2
        lngInt = prevLngInt + this._zigzagDecode(dLngRaw)
        latInt = prevLatInt + this._zigzagDecode(dLatRaw)
      }

      prevLngInt = lngInt
      prevLatInt = latInt

      // 读取名字
      const [nameLen, c3] = this._readVarint(bytes, pos); pos += c3
      let name = ''
      if (nameLen > 0 && pos + nameLen <= bytes.length) {
        name = this._bytesToStr(bytes.slice(pos, pos + nameLen))
        pos += nameLen
      }

      // 读取类型
      let typeCode = 0
      let type = ''
      if (hasType && pos < bytes.length) {
        typeCode = bytes[pos]
        type = typeMap[typeCode] || ''
        pos++
      }

      // 读取 createdAt
      let createdAt = Math.floor(Date.now() / 1000)
      if (hasCreatedAt && pos + 4 <= bytes.length) {
        createdAt = ((bytes[pos] << 24) | (bytes[pos + 1] << 16) | (bytes[pos + 2] << 8) | bytes[pos + 3]) >>> 0
        pos += 4
        if (createdAt <= 0) createdAt = Math.floor(Date.now() / 1000)
      }
      
      // 读取载具配件信息
      let vehicleId = 0
      let partsMask = 0xFFFF
      if (hasVehicleParts && typeCode === 2 && pos + 3 <= bytes.length) {
        vehicleId = bytes[pos]
        partsMask = (bytes[pos + 1] << 8) | bytes[pos + 2]
        pos += 3
        const vehicle = VEHICLE_TYPES.find(v => v.id === vehicleId)
        if (vehicle && vehicle.icon) emoji = vehicle.icon
      }

      const typeConf = MARKER_TYPES[type]
      markers.push({
        id: 'imported_' + Date.now() + '_' + i,
        lng: lngInt / 10000,
        lat: latInt / 10000,
        name,
        type,
        vehicleId,
        partsMask,
        emoji: typeConf ? typeConf.emoji : '',
        createdAt
      })
    }
    return markers
  },

  /** 解码旧文本格式标记（兼容） */
  _decodeTextMarkers(bytes) {
    const payload = this._bytesToStr(bytes)
    if (!payload) return null
    return payload.split('|').map(item => {
      const atIdx = item.lastIndexOf('@')
      let name = '', coordStr = item
      if (atIdx > 0) {
        const afterAt = item.substring(atIdx + 1)
        if (/^-?[\d.]+,-?[\d.]+$/.test(afterAt)) {
          name = item.substring(0, atIdx)
          coordStr = afterAt
        }
      }
      const parts = coordStr.split(',')
      if (parts.length < 2) return null
      const lng = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      if (isNaN(lng) || isNaN(lat)) return null
      return { id: 'imported_' + Date.now() + '_' + Math.random(), lng, lat, name, type: '', emoji: '' }
    }).filter(Boolean)
  },

  // ========== 备份抽屉 & 筛选 ==========

  /** 显示备份抽屉 */
  showDataDrawer() {
    this.setData({ showDataDrawer: true })
  },

  /** 隐藏备份抽屉 */
  hideDataDrawer() {
    this.setData({ showDataDrawer: false })
  },

  /** 抽屉 — 导入 */
  onDrawerImport() {
    this.setData({ showDataDrawer: false })
    setTimeout(() => this.showImportDialog(), 200)
  },

  /** 抽屉 — 导出 */
  onDrawerExport() {
    this.setData({ showDataDrawer: false })
    setTimeout(() => this.exportMarkers(), 200)
  },

  /** 清空所有自定义标记（二次确认） */
  onDrawerClear() {
    this.setData({ showDataDrawer: false })
    if (this._allUserMarkers.length === 0) {
      wx.showToast({ title: '暂无标记可清空', icon: 'none' })
      return
    }
    wx.showModal({
      title: '清空所有标记',
      content: `确定删除全部 ${this._allUserMarkers.length} 个自定义标记？此操作不可撤销。`,
      confirmColor: '#C75050',
      success: (res) => {
        if (res.confirm) {
          this._allUserMarkers = []
          const poiMarkers = this.data.markers.filter(m => m.src === 'poi')
          this.setData({
            markers: poiMarkers,
            selectedMarker: null,
            selectedMarkerIndex: -1,
            showInfoWindow: false
          })
          this._onUserChange()
          wx.showToast({ title: '已清空所有标记' })
        }
      }
    })
  },

  /** 筛选按钮 */
  onFilterTap() {
    this.setData({ showFilterPanel: true, filterFullMode: false })
  },

  /** 切换完整/精简模式 */
  toggleFilterMode() {
    this.setData({ filterFullMode: !this.data.filterFullMode })
  },

  /** 关闭筛选面板 */
  closeFilterPanel() {
    this.setData({ showFilterPanel: false })
  },

  /** 展开/折叠大类 */
  toggleGroup(e) {
    const group = e.currentTarget.dataset.group
    const expanded = { ...this.data.expandedGroups }

    // 展开时预加载该大类的数据（计算小类点位数），自定义标记无需加载 POI 数据
    if (group !== '_custom' && !expanded[group]) {
      this._getSectionData(group)
    }

    expanded[group] = !expanded[group]
    this.setData({ expandedGroups: expanded })
  },

  /** 清除所有筛选 */
  resetPoiFilter() {
    this.setData({
      activePoiCats: [],
      activePoiMap: {},
      activeUserMarkerTypes: [],
      activeUserMarkerMap: {},
      showUserMarkers: true
    })
    this._updateSectionSelectedCounts()
    this._rebuildDisplayMarkers()
    this._poiPixelCache = null
    this._schedulePoiRefresh()
    this._onUserChange()
  },

  /** 切换小类开关 */
  togglePoiSub(e) {
    const catId = e.currentTarget.dataset.catid  // 字符串
    let active = [...this.data.activePoiCats]
    const idx = active.indexOf(catId)

    if (idx >= 0) {
      active.splice(idx, 1)
    } else {
      if (active.length >= 5) {
        wx.showToast({ title: '最多同时开启5个小类', icon: 'none' })
        return
      }
      active.push(catId)
    }

    const activePoiMap = {}
    active.forEach(id => { activePoiMap[id] = true })
    this.setData({ activePoiCats: active, activePoiMap })
    this._updateSectionSelectedCounts()
    this._poiPixelCache = null
    this._schedulePoiRefresh()
    this._onUserChange()
  },

  /** 切换自定义标记显示总开关 */
  toggleShowUserMarkers() {
    const show = !this.data.showUserMarkers
    const active = show ? ['none', 'house', 'vehicle', 'box'] : []
    const activeUserMarkerMap = {}
    active.forEach(id => { activeUserMarkerMap[id] = true })
    const sectionSelectedCounts = { ...this.data.sectionSelectedCounts, '_custom': active.length }
    this.setData({ showUserMarkers: show, activeUserMarkerTypes: active, activeUserMarkerMap, sectionSelectedCounts })
    this._rebuildDisplayMarkers()
    this._onUserChange()
  },

  /** 切换自定义标记类型筛选 */
  toggleUserMarkerType(e) {
    const typeId = e.currentTarget.dataset.typeid
    let active = [...this.data.activeUserMarkerTypes]
    const idx = active.indexOf(typeId)
    if (idx >= 0) {
      active.splice(idx, 1)
    } else {
      active.push(typeId)
    }
    const activeUserMarkerMap = {}
    active.forEach(id => { activeUserMarkerMap[id] = true })
    const showUserMarkers = active.length > 0
    const sectionSelectedCounts = { ...this.data.sectionSelectedCounts, '_custom': active.length }
    this.setData({ activeUserMarkerTypes: active, activeUserMarkerMap, showUserMarkers, sectionSelectedCounts })
    this._rebuildDisplayMarkers()
    this._onUserChange()
  },

  /** 更新每个大类的选中小类计数 */
  _updateSectionSelectedCounts() {
    const { activePoiMap, poiCategories, activeUserMarkerTypes } = this.data
    const counts = {}
    poiCategories.forEach(section => {
      let selected = 0
      for (const catId of Object.keys(section.subs)) {
        if (activePoiMap[catId]) selected++
      }
      counts[section.name] = selected
    })
    counts['_custom'] = activeUserMarkerTypes.length
    this.setData({ sectionSelectedCounts: counts })
  },

  /** 更新各类型用户标记数量 */
  _updateUserMarkerTypeCounts() {
    const counts = {}
    this._allUserMarkers.forEach(m => {
      const typeId = m.type || 'none'
      counts[typeId] = (counts[typeId] || 0) + 1
    })
    this.setData({ userMarkerTypeCounts: counts })
  },

  /** 获取经过类型筛选的用户标记（从 _allUserMarkers 读取） */
  _getFilteredUserMarkers() {
    const { showUserMarkers, activeUserMarkerTypes, activeUserMarkerMap } = this.data
    if (!showUserMarkers) return []
    if (activeUserMarkerTypes.length === 0) return [...this._allUserMarkers]
    return this._allUserMarkers.filter(m => activeUserMarkerMap[m.type || 'none'])
  },

  /** 重建显示数组：筛选后的用户标记 + POI 标记 */
  _rebuildDisplayMarkers() {
    const userMarkers = this._enrichMarkersWithExpiry(this._getFilteredUserMarkers())
    const poiMarkers = this.data.markers.filter(m => m.src === 'poi')
    // 将 userMarkers 放在 poiMarkers 之后，利用 WXML 渲染顺序实现置顶显示
    this.setData({ markers: [...poiMarkers, ...userMarkers] })
  },

  /** 计算标记的过期信息 */
  _computeMarkerExpiry(marker) {
    const expiryDays = this.data.markerExpiryDaysConfig[marker.type || '']
    if (!expiryDays || expiryDays <= 0) return { expiryDays: 0, remainingDays: Infinity, expiring: false }
    const now = Math.floor(Date.now() / 1000)
    const elapsed = (now - (marker.createdAt || now)) / 86400
    const remainingDays = expiryDays - elapsed
    const warnDays = this.data.markerWarnDays || 2
    return { expiryDays, remainingDays, expiring: remainingDays < warnDays }
  },

  /** 为用户标记数组附加 expiring 和 isIncomplete 字段（动画延迟统一同步） */
  _enrichMarkersWithExpiry(markers) {
    const delay = -(Date.now() % 1500) / 1000
    return markers.map(m => {
      if (m.src === 'poi') return m
      const { expiring } = this._computeMarkerExpiry(m)
      const isIncomplete = m.type === 'vehicle' && m.partsMask !== undefined && m.partsMask !== 65535
      if (expiring || isIncomplete) {
        return { ...m, expiring, isIncomplete, pulseDelay: delay + 's' }
      }
      return m
    })
  },

  /** 更新信息窗口的过期信息显示 */
  _updateInfoWindowExpiry() {
    const marker = this.data.selectedMarker
    if (!marker || marker.src === 'poi' || !marker.createdAt) return
    const { expiryDays, remainingDays } = this._computeMarkerExpiry(marker)
    const d = new Date(marker.createdAt * 1000)
    const pad = n => String(n).padStart(2, '0')
    const createdAtText = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    let remainingText
    if (remainingDays >= 0) {
      const totalMin = Math.floor(remainingDays * 1440)
      const days = Math.floor(totalMin / 1440)
      const hours = Math.floor((totalMin % 1440) / 60)
      const mins = totalMin % 60
      remainingText = days > 0 ? `${days}天${hours}小时${mins}分` : hours > 0 ? `${hours}小时${mins}分` : `${mins}分`
    } else {
      const totalMin = Math.floor(-remainingDays * 1440)
      const days = Math.floor(totalMin / 1440)
      remainingText = `已过期 ${days} 天`
    }
    this.setData({
      markerCreatedAtText: createdAtText,
      markerCreatedAtDate: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
      selectedMarkerExpiryDays: expiryDays,
      selectedMarkerRemainingDays: Math.floor(remainingDays),
      markerRemainingDaysText: remainingText
    })
  },

  /**
   * 预计算 POI 逻辑像素坐标缓存
   * 筛选切换时调用一次，避免每次手势结束都做坐标转换
   */
  _buildPoiPixelCache() {
    const { activePoiCats } = this.data
    const cache = []
    activePoiCats.forEach(catId => {
      const section = CAT_SECTION[catId]
      if (!section) return
      const sectionPoints = this._getSectionData(section)
      sectionPoints.forEach(p => {
        if (String(p.cat) !== catId) return
        cache.push({
          id: p.id,
          cat: p.cat,
          lng: p.lng,
          lat: p.lat,
          // 游戏坐标 → 地图逻辑像素 (0 ~ 1280)
          mpx: (p.lng - GEO_LNG_LEFT) / (GEO_LNG_RIGHT - GEO_LNG_LEFT) * FULL_MAP,
          mpy: (p.lat - GEO_LAT_TOP) / (GEO_LAT_BOTTOM - GEO_LAT_TOP) * FULL_MAP
        })
      })
    })
    this._poiPixelCache = cache
    return cache
  },

  /**
   * 刷新 POI 标记
   * Step 1: 网格聚合（逻辑坐标，缩放自适应，拖拽稳定）
   * Step 2: 视口裁剪（半屏 margin）
   * Step 3: 硬上限 200
   */
  _refreshPoiMarkers() {
    const mapComp = this.selectComponent('#tileMap')
    if (!mapComp) return

    // 取缓存或首次构建
    const cache = this._poiPixelCache || this._buildPoiPixelCache()

    if (cache.length === 0) {
      const userMarkers = this._enrichMarkersWithExpiry(this._getFilteredUserMarkers())
      this.setData({ markers: userMarkers })
      return
    }

    const scale = mapComp.getScale()
    const vw = mapComp._vw || 375
    const vh = mapComp._vh || 600
    const offsetX = mapComp.data.offsetX
    const offsetY = mapComp.data.offsetY

    // ── Step 1: 网格聚合 ──
    // 格子大小 = MIN_SCREEN_DIST / scale（逻辑像素）
    // 缩小时格子大 → 聚合激进；放大到 SCALE_THRESHOLD 后关闭聚合
    let clustered
    if (scale >= SCALE_THRESHOLD) {
      clustered = cache
    } else {
      const cellSize = MIN_SCREEN_DIST / scale
      const buckets = {}
      cache.forEach(p => {
        const cx = Math.floor(p.mpx / cellSize)
        const cy = Math.floor(p.mpy / cellSize)
        const key = cx + '_' + cy + '_' + p.cat
        if (!buckets[key]) buckets[key] = p
      })
      clustered = Object.values(buckets)
    }

    // ── Step 2: 视口裁剪（半屏 margin，拖拽时不易闪烁） ──
    const margin = Math.max(vw, vh) * 0.5
    const result = []
    clustered.forEach(p => {
      const sx = p.mpx * scale + offsetX
      const sy = p.mpy * scale + offsetY
      if (sx > -margin && sx < vw + margin && sy > -margin && sy < vh + margin) {
        result.push(p)
      }
    })

    // ── Step 3: 硬上限 ──
    if (result.length > MAX_POI_RENDER) result.length = MAX_POI_RENDER

    const poiMarkers = result.map(p => ({
      id: 'poi_' + p.id,
      lng: p.lng,
      lat: p.lat,
      name: CAT_CN[p.cat] || '',
      src: 'poi',
      cat: String(p.cat),
      emoji: CAT_EMOJI[p.cat] || '📍'
    }))

    const userMarkers = this._enrichMarkersWithExpiry(this._getFilteredUserMarkers())
    this.setData({ markers: [...userMarkers, ...poiMarkers] })
  },

  /** 按需加载 section 数据（带缓存） */
  _getSectionData(section) {
    if (!this._sectionCache) this._sectionCache = {}
    if (!this._sectionCache[section]) {
      this._sectionCache[section] = require('../../data/poi/poi-' + section + '.js')
      // 计算该 section 中每个 catId 的点位数
      const counts = {}
      this._sectionCache[section].forEach(p => {
        counts[p.cat] = (counts[p.cat] || 0) + 1
      })
      // 合并到 poiCatCounts
      const allCounts = { ...this.data.poiCatCounts, ...counts }
      this.setData({ poiCatCounts: allCounts })
    }
    return this._sectionCache[section]
  },

  /** 查找小类中文名 */
  _getPoiCatName(catId) {
    return CAT_CN[catId] || '未知'
  },

  /** 显示导入弹窗 */
  showImportDialog() {
    this.setData({ showImportDialog: true, importInputValue: '' })
  },

  /** 隐藏导入弹窗 */
  hideImportDialog() {
    this.setData({ showImportDialog: false })
  },

  /** 导入输入框内容变化 */
  onImportInputChange(e) {
    this.setData({ importInputValue: e.detail.value })
  },

  /** 导入标记 */
  importMarkers() {
    const code = this.data.importInputValue.trim()
    if (!code) {
      wx.showToast({ title: '请粘贴标记代码', icon: 'none' })
      return
    }
    const decoded = this._decodeMarkers(code)
    if (!decoded || decoded.length === 0) {
      wx.showToast({ title: '无效的标记代码', icon: 'none' })
      return
    }

    const doImport = (markers) => {
      let truncated = false
      if (markers.length > USER_MARKER_LIMIT) {
        markers = markers.slice(0, USER_MARKER_LIMIT)
        truncated = true
      }
      this._allUserMarkers = markers
      const poiMarkers = this.data.markers.filter(m => m.src === 'poi')
      this.setData({
        markers: [...markers, ...poiMarkers],
        selectedMarker: null,
        selectedMarkerIndex: -1,
        showInfoWindow: false,
        showImportDialog: false
      })
      wx.vibrateShort({ type: 'medium' })
      this._onUserChange()
      this._schedulePoiRefresh()
      if (truncated) {
        wx.showToast({ title: `最多${USER_MARKER_LIMIT}个，已截取前${USER_MARKER_LIMIT}个`, icon: 'none', duration: 2000 })
      } else {
        wx.showToast({ title: `已导入 ${markers.length} 个标记` })
      }
    }

    if (this._allUserMarkers.length > 0) {
      wx.showModal({
        title: '导入自定义标记',
        content: `当前有 ${this._allUserMarkers.length} 个标记，导入将替换，确定？`,
        success: (res) => {
          if (res.confirm) doImport(decoded)
          else this.setData({ showImportDialog: false })
        }
      })
    } else {
      doImport(decoded)
    }
  },

  /** 导出标记 */
  exportMarkers() {
    const userMarkers = this._allUserMarkers
    if (userMarkers.length === 0) {
      wx.showToast({ title: '暂无标记可导出', icon: 'none' })
      return
    }
    const code = this._encodeMarkers(userMarkers)
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: `代码已复制到剪贴板，可以粘贴到其他地方保存备用`, icon: 'none', duration: 3000 })
      }
    })
  },

  /** 导航到目标坐标 */
  navigateToTarget(lng, lat) {
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp && lng && lat) {
      mapComp.moveToGeo(lng, lat)
    }
  },

  /** 返回 */
  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  dismissGuide() {
    wx.setStorageSync('hasSeenGuide', true)
    this.setData({ showGuide: false })
  },

  /** 手势结束 — 安排一次 POI 刷新（防抖 200ms，不打断 WXS 动画） */
  onGestureEnd() {
    this._schedulePoiRefresh()
  },

  /** 地图组件初始化完成，刷新 POI 标记 */
  onMapReady() {
    this._schedulePoiRefresh()
  },

  /** 安排 POI 刷新（防抖，独立于手势） */
  _schedulePoiRefresh() {
    if (this._poiRefreshTimer) clearTimeout(this._poiRefreshTimer)
    this._poiRefreshTimer = setTimeout(() => {
      this._refreshPoiMarkers()
    }, 200)
  },

  // ========== 本地存储 ==========

  /** 用户主动修改标记/筛选时调用 */
  _onUserChange() {
    if (this._isSharedView) {
      this._isSharedView = false
      this.setData({ showSaveBanner: false })
    }
    this._updateUserMarkerTypeCounts()
    this._saveToStorage()
  },

  /** 从本地存储恢复用户标记、筛选状态和过期配置 */
  _loadFromStorage() {
    try {
      const savedMarkers = wx.getStorageSync('scum_userMarkers')
      const savedCats = wx.getStorageSync('scum_activePoiCats')
      const savedUserTypes = wx.getStorageSync('scum_activeUserMarkerTypes')
      const savedShowUser = wx.getStorageSync('scum_showUserMarkers')
      const savedExpiryConfig = wx.getStorageSync('scum_markerExpiryDaysConfig')
      const setData = {}
      // 恢复用户标记到 _allUserMarkers（持久化数据源）
      if (Array.isArray(savedMarkers) && savedMarkers.length > 0) {
        // 旧数据兼容：补充 createdAt 字段
        const now = Math.floor(Date.now() / 1000)
        this._allUserMarkers = savedMarkers.map(m => m.createdAt ? m : { ...m, createdAt: now })
        setData.markers = this._allUserMarkers
      }
      if (Array.isArray(savedCats) && savedCats.length > 0) {
        setData.activePoiCats = savedCats
        const activePoiMap = {}
        savedCats.forEach(id => { activePoiMap[id] = true })
        setData.activePoiMap = activePoiMap
        this._poiPixelCache = null
        setTimeout(() => this._schedulePoiRefresh(), 300)
      }
      if (Array.isArray(savedUserTypes)) {
        const activeUserMarkerMap = {}
        savedUserTypes.forEach(id => { activeUserMarkerMap[id] = true })
        setData.activeUserMarkerTypes = savedUserTypes
        setData.activeUserMarkerMap = activeUserMarkerMap
      }
      if (savedShowUser === false) {
        setData.showUserMarkers = false
      }
      if (savedExpiryConfig && typeof savedExpiryConfig === 'object') {
        setData.markerExpiryDaysConfig = { ...MARKER_EXPIRY_DAYS, ...savedExpiryConfig }
      }
      const savedWarnDays = wx.getStorageSync('scum_markerWarnDays')
      if (typeof savedWarnDays === 'number' && savedWarnDays >= 0) {
        setData.markerWarnDays = savedWarnDays
      }
      if (Object.keys(setData).length > 0) {
        this.setData(setData)
        this._updateSectionSelectedCounts()
        this._updateUserMarkerTypeCounts()
        // 无 POI 刷新时需要手动重建显示（有 POI 时由 _schedulePoiRefresh 处理）
        const hasPoiRefresh = savedCats && savedCats.length > 0
        if (!hasPoiRefresh && savedMarkers && savedMarkers.length > 0) {
          this._rebuildDisplayMarkers()
        }
      }
    } catch (e) {
      console.warn('[Storage] 加载失败:', e)
    }
  },

  /** 保存用户标记、筛选状态和过期配置到本地存储（防抖） */
  _saveToStorage() {
    if (this._saveTimer) clearTimeout(this._saveTimer)
    this._saveTimer = setTimeout(() => {
      try {
        wx.setStorageSync('scum_userMarkers', this._allUserMarkers)
        wx.setStorageSync('scum_activePoiCats', this.data.activePoiCats)
        wx.setStorageSync('scum_activeUserMarkerTypes', this.data.activeUserMarkerTypes)
        wx.setStorageSync('scum_showUserMarkers', this.data.showUserMarkers)
        wx.setStorageSync('scum_markerExpiryDaysConfig', this.data.markerExpiryDaysConfig)
        wx.setStorageSync('scum_markerWarnDays', this.data.markerWarnDays)
      } catch (e) {
        console.warn('[Storage] 保存失败:', e)
      }
    }, 300)
  },

  /** 显示保存确认弹窗 */
  saveToLocal() {
    this.setData({ showSaveConfirm: true })
  },

  /** 保存确认：覆盖存档 */
  onSaveConfirm() {
    this.setData({ showSaveConfirm: false })
    try {
      wx.setStorageSync('scum_userMarkers', this._allUserMarkers)
      wx.setStorageSync('scum_activePoiCats', this.data.activePoiCats)
      wx.setStorageSync('scum_markerExpiryDaysConfig', this.data.markerExpiryDaysConfig)
      wx.setStorageSync('scum_markerWarnDays', this.data.markerWarnDays)
      wx.showToast({ title: '已保存到本地', icon: 'success' })
      this._isSharedView = false
      this.setData({ showSaveBanner: false })
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    }
  },

  /** 保存确认：取消 */
  onSaveCancel() {
    this.setData({ showSaveConfirm: false })
  },

  /** 保存确认：覆盖前备份（导出本地存储中的旧数据） */
  onSaveBackup() {
    this.setData({ showSaveConfirm: false })
    try {
      const savedMarkers = wx.getStorageSync('scum_userMarkers')
      if (!Array.isArray(savedMarkers) || savedMarkers.length === 0) {
        wx.showToast({ title: '本地暂无存档可备份', icon: 'none' })
        return
      }
      const code = this._encodeMarkers(savedMarkers)
      wx.setClipboardData({
        data: code,
        success: () => {
          wx.showToast({ title: '旧存档已复制到剪贴板，可以粘贴到其他地方保存备用', icon: 'none', duration: 3000 })
        }
      })
    } catch (e) {
      wx.showToast({ title: '备份失败', icon: 'none' })
    }
  },

  /** 微信分享 */
  onShareAppMessage() {
    const { selectedMarker, activePoiCats } = this.data

    // 场景一：信息窗内点分享按钮，只分享当前这一个标记
    if (selectedMarker && this.data.showInfoWindow) {
      const vid = selectedMarker.vehicleId || 1
      const mask = selectedMarker.partsMask !== undefined ? selectedMarker.partsMask : 0xFFFF
      const encoded = `${selectedMarker.lng},${selectedMarker.lat},${encodeURIComponent(selectedMarker.name || '')},${selectedMarker.type || ''},${selectedMarker.createdAt || 0},${vid},${mask}`
      const exp = this.data.markerExpiryDaysConfig
      const expStr = `${exp[''] || 0},${exp.house || 0},${exp.vehicle || 0},${exp.box || 0},${this.data.markerWarnDays || 2}`
      return {
        title: '我在SCUM地图上标记了一个位置',
        path: `/packageMap/pages/map/map?markers=${encoded}&exp=${expStr}`
      }
    }

    // 场景二：底部栏分享当前页
    const userMarkers = this._allUserMarkers
    const params = []
    const parts = []

    // 用户自定义标记
    if (userMarkers.length > 0) {
      const encoded = userMarkers.map(m => {
        const vid = m.vehicleId || 1
        const mask = m.partsMask !== undefined ? m.partsMask : 0xFFFF
        return `${m.lng},${m.lat},${encodeURIComponent(m.name || '')},${m.type || ''},${m.createdAt || 0},${vid},${mask}`
      }).join('|')
      params.push(`markers=${encoded}`)
      parts.push(`${userMarkers.length}个标记`)
    }

    // 过期配置
    const exp = this.data.markerExpiryDaysConfig
    const expStr = `${exp[''] || 0},${exp.house || 0},${exp.vehicle || 0},${exp.box || 0},${this.data.markerWarnDays || 2}`
    params.push(`exp=${expStr}`)

    // POI 筛选分类
    if (activePoiCats.length > 0) {
      params.push(`poiCats=${activePoiCats.join(',')}`)
      parts.push(`${activePoiCats.length}类探索点`)
    }

    if (params.length > 0) {
      return {
        title: `我给你分享了${parts.join('和')}`,
        path: `/packageMap/pages/map/map?${params.join('&')}`
      }
    }

    return {
      title: '来看看SCUM地图',
      path: '/packageMap/pages/map/map'
    }
  }
})
