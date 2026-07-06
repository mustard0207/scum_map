const app = getApp()
const huntingData = require('../../data/hunting.js')

Page({
  data: {
    statusBarHeight: 20,
    panelHeight: 300,
    zoomSliderPercent: 0,
    
    // 界面模式: 'animal' (图鉴模式) | 'probe' (探测模式)
    currentMode: 'animal',
    lang: 'zh', // 'zh' | 'en'
    sliderActive: false, // 控制滑动条的透明度
    showGuide: false, // 是否显示使用引导
    
    
    // === 图鉴模式数据 ===
    animalList: [],
    selectedAnimal: '',
    animalDict: {},
    animalHabitatBiomes: [], // 当前选中动物的栖息地数组 [{name, color}]
    
    // === 探测模式数据 ===
    probeLng: 0,
    probeLat: 0,
    probeBiome: '',       // 探测到的内部名
    probeBiomeName: '',   // 展示名
    probeBiomeColor: '',
    probeAnimals: [],     // 探测到的动物列表
    
    // === 地图交互数据 ===
    huntingZones: [],     // 传递给地图组件的当前要渲染的圆圈
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    this.setData({ 
      statusBarHeight: sysInfo.statusBarHeight || 20,
      panelHeight: sysInfo.windowHeight * 0.4
    })
    
    // 首次引导检查
    if (!wx.getStorageSync('hasSeenGuide_hunting')) {
      this.setData({ showGuide: true })
    }
    
    this._initAnimalList()
  },

  onReady() {
    this.mapCtx = this.selectComponent('#tileMap')
  },

  /** 初始化动物列表 */
  _initAnimalList() {
    const dict = huntingData.ANIMALS
    const list = []
    
    // 手动配个 emoji，让界面生动一点 (驴 🫏 在部分旧设备可能不显示，替换为 🐴)
    const emojiMap = {
      bear: '🐻', boar: '🐗', chicken: '🐔', deer: '🦌',
      donkey: '🐴', goat: '🐐', horse: '🐎', rabbit: '🐇', wolf: '🐺'
    }
    
    for (const key in dict) {
      list.push({
        id: key,
        nameZh: dict[key].name.zh,
        nameEn: dict[key].name.en,
        emoji: emojiMap[key] || '🐾'
      })
    }
    
    this.setData({
      animalList: list,
      animalDict: dict
    })
  },

  /** 地图加载完毕 */
  onMapReady() {
    // 默认可以选第一个动物，或者留空
    // this.onSelectAnimal({ currentTarget: { dataset: { id: 'bear' } } })
  },

  /** 返回按钮 */
  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  /** 使用引导相关 */
  openGuide() {
    this.setData({ showGuide: true })
  },

  dismissGuide() {
    this.setData({ showGuide: false })
    wx.setStorageSync('hasSeenGuide_hunting', true)
  },

  // ==================== 模式 A：动物图鉴 ====================

  /** 用户在底部列表选择了某只动物 */
  onSelectAnimal(e) {
    const id = e.currentTarget.dataset.id
    
    // 如果点击的是当前已选中的动物，则执行取消选中逻辑
    if (this.data.selectedAnimal === id) {
      this.setData({
        selectedAnimal: '',
        animalHabitatBiomes: []
      })
      
      // 只有在图鉴模式下，取消选中才清空地图上的圈圈
      if (this.data.currentMode === 'animal') {
        this.setData({ huntingZones: [] })
      }
      return
    }
    
    // 查询该动物在哪些地形出没
    const biomes = huntingData.ANIMAL_BIOMES[id] || []
    
    // 构建栖息地标签
    const habitatTags = []
    
    // 为了将圈圈推给地图
    const activeBiomesSet = new Set()
    
    biomes.forEach(bInfo => {
      const bName = bInfo.b
      activeBiomesSet.add(bName)
      
      // 简单映射地形中文名 (这里如果未来有更全的字典可以替换)
      const bZhMap = {
        'ContinentalForest': '大陆森林',
        'ContinentalMeadow': '大陆草甸',
        'Mediterranean': '地中海气候区',
        'Mountain': '高山地带',
        'Urban': '城市废墟',
        'Village': '村落区域'
      }
      
      habitatTags.push({
        nameZh: bZhMap[bName] || bName,
        nameEn: bName,
        color: huntingData.BIOME_COLORS[bName]
      })
    })
    
    this.setData({
      selectedAnimal: id,
      animalHabitatBiomes: habitatTags
    })
    
    // 只有在图鉴模式下，选择动物才会改变全图的分布圈圈
    // 在探测模式下，圈圈代表的是当前探测到的地形范围，不随选择动物而改变
    if (this.data.currentMode === 'animal') {
      const zones = huntingData.ZONES
      const targetZones = []
      
      for (let i = 0; i < zones.length; i++) {
        if (activeBiomesSet.has(zones[i].b)) {
          targetZones.push({
            ...zones[i],
            color: huntingData.BIOME_COLORS[zones[i].b]
          })
        }
      }
      
      this.setData({ huntingZones: targetZones })
      
      // 强制地图重新计算截断和显示
      if (this.mapCtx) {
        this.mapCtx._refreshOverlay()
      }
    }
  },

  // ==================== 模式 B：地形探测 ====================

  /** 点击探测按钮 (使用屏幕中央的准星位置) */
  onProbeTap() {
    if (!this.mapCtx) return
    
    // 准星固定在地图区域的中心
    const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    const mapAreaHeight = sysInfo.windowHeight - this.data.panelHeight
    
    const centerX = sysInfo.windowWidth / 2
    const centerY = mapAreaHeight / 2
    
    const geo = this.mapCtx.screenToGeo(centerX, centerY)
    this._doProbeAtGeo(geo.lng, geo.lat)
  },

  /** 直接点击了地图 */
  onMapTap(e) {
    const { geoLng, geoLat } = e.detail
    // 让准星飞过去 (居中)
    if (this.mapCtx) {
      this.mapCtx.moveToGeo(geoLng, geoLat)
    }
    // 探测该点
    this._doProbeAtGeo(geoLng, geoLat)
  },

  /** 核心：在指定游戏坐标探测 */
  _doProbeAtGeo(lng, lat) {
    // 1. 碰撞检测：遍历 ZONES，找包含该点的圆。如果有重叠，取 radius 最小的（最精细的局部特征）
    let hitBiome = null
    let minRadius = Infinity
    
    for (let i = 0; i < huntingData.ZONES.length; i++) {
      const z = huntingData.ZONES[i]
      const dx = lng - z.x
      const dy = lat - z.y
      const distSq = dx * dx + dy * dy
      if (distSq <= z.r * z.r) {
        if (z.r < minRadius) {
          minRadius = z.r
          hitBiome = z.b
        }
      }
    }
    
    if (!hitBiome) {
      // 没探测到
      this.setData({
        probeBiome: '',
        probeBiomeName: '',
        probeAnimals: [],
        huntingZones: [] // 清空圈圈
      })
      return
    }
    
    // 2. 查出该地形
    const bZhMap = {
      'ContinentalForest': '大陆森林',
      'ContinentalMeadow': '大陆草甸',
      'Mediterranean': '地中海气候区',
      'Mountain': '高山地带',
      'Urban': '城市废墟',
      'Village': '村落区域'
    }
    
    const color = huntingData.BIOME_COLORS[hitBiome]
    
    // 3. 查出该地形的所有动物
    const animalsInBiome = huntingData.BIOME_ANIMALS[hitBiome] || []
    const probeAnimals = []
    
    const emojiMap = {
      bear: '🐻', boar: '🐗', chicken: '🐔', deer: '🦌',
      donkey: '🐴', goat: '🐐', horse: '🐎', rabbit: '🐇', wolf: '🐺'
    }
    
    animalsInBiome.forEach(a => {
      probeAnimals.push({
        id: a.id,
        nameZh: huntingData.ANIMALS[a.id].name.zh,
        nameEn: huntingData.ANIMALS[a.id].name.en,
        emoji: emojiMap[a.id] || '🐾'
      })
    })
    
    // 4. 将探测到的单一地形所有圆圈绘制出来 (给你看它的范围)
    const targetZones = []
    for (let i = 0; i < huntingData.ZONES.length; i++) {
      if (huntingData.ZONES[i].b === hitBiome) {
        targetZones.push({
          ...huntingData.ZONES[i],
          color: color
        })
      }
    }
    
    this.setData({
      currentMode: 'probe',
      probeLng: Math.round(lng),
      probeLat: Math.round(lat),
      probeBiome: hitBiome,
      probeBiomeName: bZhMap[hitBiome] || hitBiome,
      probeBiomeColor: color,
      probeAnimals: probeAnimals,
      huntingZones: targetZones
    })
    
    // 如果当前选中的动物不在这里面，清空当前动物；如果在里面，保留显示它的诱饵
    const isSelectedStillHere = probeAnimals.find(a => a.id === this.data.selectedAnimal)
    if (!isSelectedStillHere && probeAnimals.length > 0) {
      // 默认选中第一个探测到的动物
      this.setData({ selectedAnimal: probeAnimals[0].id })
    }
  },

  /** 返回图鉴模式 */
  returnToAnimalMode() {
    this.setData({
      currentMode: 'animal',
      probeBiome: '',
      probeAnimals: []
    })
    
    if (this.data.selectedAnimal) {
      // 手动触发一次选中刷新圈圈
      this.onSelectAnimal({ currentTarget: { dataset: { id: this.data.selectedAnimal } } })
    } else {
      this.setData({ huntingZones: [] })
    }
  },

  /** 切换语言 */
  toggleLang() {
    this.setData({
      lang: this.data.lang === 'zh' ? 'en' : 'zh'
    })
  },

  // ==================== 缩放组件交互 ====================
  onZoomSliderStart(e) {
    this._sliderActive = true
    this.setData({ sliderActive: true })
    this._sliderStartY = e.touches[0].clientY
    if (this.mapCtx) {
      this._sliderStartScale = this.mapCtx.getScale()
      this._sliderMinScale = this.mapCtx.getMinScale() || 0.2
    }
  },

  onZoomSliderMove(e) {
    if (!this._sliderActive || this._sliderStartY === undefined) return
    const sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    if (!sysInfo) return
    
    const minScale = this._sliderMinScale || 0.2
    const maxScale = 8
    const dy = this._sliderStartY - e.touches[0].clientY // 上拉为正
    
    const sliderRange = 140 // 拖拉条有效像素范围
    const scaleDelta = (dy / sliderRange) * (maxScale - minScale)
    const newScale = Math.max(minScale, Math.min(maxScale, this._sliderStartScale + scaleDelta))
    
    const mapAreaHeight = sysInfo.windowHeight - this.data.panelHeight
    const cx = sysInfo.windowWidth / 2
    const cy = mapAreaHeight / 2
    
    if (this.mapCtx) {
      this.mapCtx.zoomTo(newScale, cx, cy)
    }
    
    const percent = ((newScale - minScale) / (maxScale - minScale)) * 100
    this.setData({ zoomSliderPercent: Math.max(0, Math.min(100, percent)) })
  },

  onZoomSliderEnd(e) {
    this._sliderActive = false
    this.setData({ sliderActive: false })
    this._sliderStartY = undefined
  },

  resetMapView() {
    if (this.mapCtx) {
      this.mapCtx.resetView()
      this.setData({ zoomSliderPercent: 0 })
    }
  },

  /** 监听 WXS 手势带来的自然缩放，同步更新滑动条 */
  onGestureEnd(e) {
    if (this._sliderActive || !this.mapCtx) return
    const scale = e.detail.scale
    const minScale = this.mapCtx.getMinScale() || 0.2
    const maxScale = 8
    
    const logMin = Math.log(minScale)
    const logMax = Math.log(maxScale)
    const logCur = Math.log(Math.max(minScale, Math.min(scale, maxScale)))
    
    let percent = ((logCur - logMin) / (logMax - logMin)) * 100
    this.setData({ zoomSliderPercent: percent })
  },
  
  onShareAppMessage() {
    return {
      title: 'SCUM 狩猎助手',
      path: '/packageMap/pages/hunting/hunting'
    }
  },

  onShareTimeline() {
    return {
      title: 'SCUM 狩猎助手',
      query: ''
    }
  }
})
