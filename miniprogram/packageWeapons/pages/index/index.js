const app = getApp()
const weaponsDataZh = require('../../data/weapons.js')
const weaponsDataEn = require('../../data/weapons_en.js')

Page({
  data: {
    statusBarHeight: 0,
    allWeapons: [],
    filteredWeapons: [],
    categories: ['全部', '步枪', '手枪', '冲锋枪', '狙击', '霰弹', '弓弩'],
    currentCategory: '全部',
    caliberOptions: ['全部口径'], // 下拉选择器选项
    selectedCaliberIndex: 0,
    expandedMap: {}, // 记录展开状态
    isEnglish: false, // 英文开关
    currentSortField: '', // 排序字段: damage, rpm, range
    sortOrder: '', // 排序方向: asc, desc
    
    // 缓存原始的格式化数据
    _formattedZh: [],
    _formattedEn: []
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo()
    
    // 修复部分口径缺失小数点的问题
    const formatCaliber = (cal) => {
      if (!cal) return ''
      return cal
        .replace('762x', '7.62x')
        .replace('545x', '5.45x')
        .replace('556x', '5.56x')
        .replace('792x', '7.92x')
    }

    // 格式化中文数据
    const formattedZh = weaponsDataZh.map(w => ({
      name: w['名称'] || '',
      damage: w['伤害'] || '',
      rpm: w['射速 (RPM)'] || '',
      range: w['有效射程 (米)'] || '',
      caliber: formatCaliber(w['默认口径']),
      weight: w['重量 (kg)'] || '',
      slots: w['背包占格'] || '',
      ammo: w['适配弹药'] || [],
      mags: w['适配弹匣'] || [],
      sights: w['近瞄镜 (红点/全息)'] || [],
      scopes: w['远瞄镜 (高倍镜)'] || [],
      suppressors: w['消音器'] || [],
      rails: w['导轨适配器'] || [],
      lights: w['战术手电/枪灯'] || [],
      bayonets: w['刺刀'] || []
    }))

    // 过滤英文弹药的冗余型号（去掉自制、穿甲、曳光、弹药盒、各种特殊箭头等）
    const filterEnglishAmmo = (ammoArray) => {
      if (!ammoArray || !Array.isArray(ammoArray)) return []
      return ammoArray.filter(a => {
        const l = a.toLowerCase()
        if (l.includes('crafted') || l.includes('ap') || l.includes('armor piercing') || l.includes('tracer') || l.includes('box')) return false
        if (l.includes('birdshot') || l.includes('improvised') || l.includes('slug')) return false
        if (l.includes('broadhead') || l.includes('explosive') || l.includes('fletched') || l.includes('tip') || l.includes('dildo') || l.includes('specialist')) return false
        return true
      })
    }

    // 格式化英文数据
    const formattedEn = weaponsDataEn.map(w => ({
      name: w['Name'] || '',
      damage: w['Damage'] || '',
      rpm: w['Fire Rate (RPM)'] || '',
      range: w['Effective Range (m)'] || '',
      caliber: formatCaliber(w['Caliber']),
      weight: w['Weight (kg)'] || '',
      slots: w['Grid Size'] || '',
      ammo: filterEnglishAmmo(w['Ammunition']),
      mags: w['Magazines'] || [],
      sights: w['Sights'] || [],
      scopes: w['Scopes'] || [],
      suppressors: w['Suppressors'] || [],
      rails: w['Rails'] || [],
      lights: w['Flashlights'] || [],
      bayonets: w['Bayonets'] || []
    }))

    // 提取不重复的口径列表
    const rawCalibers = formattedZh.map(w => w.caliber).filter(c => c && c !== 'N/A')
    const uniqueCalibers = [...new Set(rawCalibers)]
    uniqueCalibers.sort((a, b) => a.localeCompare(b))
    const caliberOptions = ['全部口径', ...uniqueCalibers]

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      caliberOptions: caliberOptions,
      _formattedZh: formattedZh,
      _formattedEn: formattedEn,
      allWeapons: formattedZh,
      filteredWeapons: formattedZh
    })
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  // 切换中英文
  toggleLanguage(e) {
    const isEnglish = e.detail.value
    const newData = isEnglish ? this.data._formattedEn : this.data._formattedZh
    this.setData({ 
      isEnglish: isEnglish,
      allWeapons: newData
    })
    this.filterWeapons(true) // 传入 true 保留展开状态
  },

  // 切换弹药口径筛选
  onCaliberChange(e) {
    this.setData({
      selectedCaliberIndex: e.detail.value
    })
    this.filterWeapons()
  },

  // 清空口径筛选
  clearFilter() {
    this.setData({
      selectedCaliberIndex: 0
    })
    this.filterWeapons()
  },
  // 分类选择
  onCategorySelect(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: category })
    this.filterWeapons()
  },

  // 切换排序
  onSort(e) {
    const field = e.currentTarget.dataset.field
    let { currentSortField, sortOrder } = this.data

    if (currentSortField === field) {
      if (sortOrder === 'desc') sortOrder = 'asc'
      else if (sortOrder === 'asc') {
        currentSortField = ''
        sortOrder = ''
      }
    } else {
      currentSortField = field
      sortOrder = 'desc'
    }

    this.setData({ currentSortField, sortOrder })
    this.filterWeapons()
  },

  // 过滤逻辑
  filterWeapons(keepExpanded = false) {
    const { allWeapons, searchQuery, currentCategory, _formattedZh, _formattedEn, currentSortField, sortOrder, caliberOptions, selectedCaliberIndex } = this.data
    
    let result = [...allWeapons] // 复制一份进行排序，以免破坏原数组

    // 1. 按分类过滤 (始终使用中文的名称作为分类基准)
    if (currentCategory !== '全部') {
      result = result.filter((w, index) => {
        // 由于 allWeapons 可能被排序过，我们需要找到原始的中文名
        // 最安全的做法是通过对比原始数组获取 index
        const originalIndex = allWeapons.indexOf(w)
        const zhName = _formattedZh[originalIndex].name || ''
        if (currentCategory === '步枪') return zhName.includes('步枪') && !zhName.includes('冲锋枪') && !zhName.includes('狙击') && !zhName.includes('猎手')
        if (currentCategory === '手枪') return zhName.includes('手枪') || zhName.includes('左轮')
        if (currentCategory === '冲锋枪') return zhName.includes('冲锋枪')
        if (currentCategory === '狙击') return zhName.includes('狙击') || zhName.includes('猎手')
        if (currentCategory === '霰弹') return zhName.includes('霰弹')
        if (currentCategory === '弓弩') return zhName.includes('弓') || zhName.includes('弩')
        return true
      })
    }

    // 2. 按口径筛选
    const selectedCaliber = caliberOptions[selectedCaliberIndex]
    if (selectedCaliber !== '全部口径') {
      result = result.filter(w => {
        const originalIndex = allWeapons.indexOf(w)
        const zh = _formattedZh[originalIndex] || {}
        return zh.caliber === selectedCaliber
      })
    }

    // 4. 排序逻辑
    if (currentSortField) {
      const isAsc = sortOrder === 'asc'
      result.sort((a, b) => {
        let valA = a[currentSortField] || ''
        let valB = b[currentSortField] || ''

        if (currentSortField === 'damage' || currentSortField === 'rpm' || currentSortField === 'range') {
          const numA = parseFloat(valA)
          const numB = parseFloat(valB)
          
          const validA = !isNaN(numA)
          const validB = !isNaN(numB)

          if (validA && validB) return isAsc ? numA - numB : numB - numA
          if (validA) return -1 // 有效数值永远排在 N/A 前面
          if (validB) return 1
          return 0
        }

        if (currentSortField === 'caliber') {
          return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA)
        }
        return 0
      })
    }

    // 设置状态
    this.setData({ 
      filteredWeapons: result,
      expandedMap: keepExpanded ? this.data.expandedMap : {}
    })
  },

  // 展开/折叠卡片
  toggleCard(e) {
    const index = e.currentTarget.dataset.index
    const expandedMap = this.data.expandedMap
    expandedMap[index] = !expandedMap[index]
    this.setData({ expandedMap })
  },

  // 分享给好友
  onShareAppMessage() {
    return {
      title: 'SCUM 武器数据手册',
      path: '/packageWeapons/pages/index/index',
      imageUrl: '' // 可选：可以配置一张好看的封面图
    }
  },

  // 分享到朋友圈
  onShareTimeline() {
    return {
      title: 'SCUM 武器数据手册'
    }
  }
})