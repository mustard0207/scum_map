const app = getApp()
const seedsDataZh = require('../../data/seeds.js')
const seedsDataEn = require('../../data/seeds_en.js')
const guideData = require('../../data/gardening_guide.js')

const PINYIN_MAP = {
  '苹': 'P', '西': 'X', '卷': 'J', '特': 'T', '胡': 'H',
  '樱': 'Y', '辣': 'L', '玉': 'Y', '黄': 'H', '无': 'W',
  '大': 'D', '柠': 'N', '莴': 'W', '梨': 'L', '菜': 'C',
  '梅': 'M', '土': 'T', '南': 'N', '洋': 'Y', '菠': 'B',
  '哈': 'H', '桃': 'T', '橙': 'C', '瓯': 'O', '烟': 'Y'
}

function getFirstLetter(name, isEnglish) {
  if (!name) return ''
  if (isEnglish) {
    return name[0].toUpperCase()
  } else {
    const firstChar = name[0]
    return PINYIN_MAP[firstChar] || firstChar.toUpperCase()
  }
}

Page({
  data: {
    statusBarHeight: 0,
    isEnglish: false,
    guideExpanded: false,
    guideData: [],
    categories: ['全部', '水果', '蔬菜', '特殊'],
    currentCategory: '全部',
    currentSortField: '',
    sortOrder: '',
    allSeeds: [],
    filteredSeeds: [],
    
    // WXS panel state
    drawerHeight: 500,
    expandSignal: 0,
    collapseSignal: 0
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      drawerHeight: sysInfo.windowHeight * 0.75 // 默认占屏 75%
    })
    this.updateDataLanguage()
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  toggleLanguage() {
    wx.vibrateShort({ type: 'light' })
    const nextLang = !this.data.isEnglish
    this.setData({
      isEnglish: nextLang,
      categories: nextLang ? ['All', 'Fruits', 'Vegetables', 'Special'] : ['全部', '水果', '蔬菜', '特殊'],
      currentCategory: nextLang ? 'All' : '全部'
    })
    this.updateDataLanguage()
  },

  toggleGuide() {
    this.setData({
      guideExpanded: true,
      expandSignal: this.data.expandSignal + 1
    })
  },

  closeGuideMask() {
    this.setData({
      guideExpanded: false,
      collapseSignal: this.data.collapseSignal + 1
    })
  },

  onPanelStateChange(e) {
    if (this.data.guideExpanded !== e.isExpanded) {
      this.setData({
        guideExpanded: e.isExpanded
      })
    }
  },

  updateDataLanguage() {
    const { isEnglish } = this.data
    let currentSeedsData = isEnglish ? seedsDataEn : seedsDataZh
    const currentGuideData = isEnglish ? guideData.en : guideData.zh

    const getTempColor = (temp) => {
      if (temp <= 0) return '#79C0FF'
      if (temp >= 30) return '#E85D3A'
      if (temp < 15) {
        const ratio = temp / 15
        const r = Math.round(121 + (103 - 121) * ratio)
        const g = Math.round(192 + (194 - 192) * ratio)
        const b = Math.round(255 + (58 - 255) * ratio)
        return `rgb(${r}, ${g}, ${b})`
      }
      const ratio = (temp - 15) / 15
      const r = Math.round(103 + (232 - 103) * ratio)
      const g = Math.round(194 + (93 - 194) * ratio)
      const b = Math.round(58 + (58 - 58) * ratio)
      return `rgb(${r}, ${g}, ${b})`
    }

    const getGradientStyle = (tempStr) => {
      if (!tempStr) return ''
      const matches = tempStr.match(/-?\d+/g)
      if (!matches) return ''
      if (matches.length === 1) {
        return `color: ${getTempColor(parseInt(matches[0], 10))};`
      }
      const c1 = getTempColor(parseInt(matches[0], 10))
      const c2 = getTempColor(parseInt(matches[1], 10))
      return `background: linear-gradient(to right, ${c1}, ${c2}); -webkit-background-clip: text; color: transparent;`
    }

    currentSeedsData = currentSeedsData.map(seed => {
      return {
        ...seed,
        optimum_temp_style: getGradientStyle(seed.optimum_temp),
        survival_temp_style: getGradientStyle(seed.survival_temp)
      }
    })

    this.setData({
      allSeeds: currentSeedsData,
      guideData: currentGuideData
    }, () => {
      this.filterData()
    })
  },

  selectCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      currentCategory: category
    }, () => {
      this.filterData()
    })
  },

  filterData() {
    const { allSeeds, currentCategory, isEnglish, currentSortField, sortOrder } = this.data
    const allText = isEnglish ? 'All' : '全部'

    let filtered = allSeeds
    if (currentCategory !== allText) {
      filtered = allSeeds.filter(s => s.category === currentCategory)
    }

    if (currentSortField === 'temp' && sortOrder) {
      filtered = filtered.sort((a, b) => {
        const getTemp = (tempStr) => {
          if (!tempStr) return 0
          const match = tempStr.match(/-?\d+/)
          return match ? parseInt(match[0], 10) : 0
        }
        const tempA = getTemp(a.optimum_temp)
        const tempB = getTemp(b.optimum_temp)
        return sortOrder === 'asc' ? tempA - tempB : tempB - tempA
      })
    } else if (currentSortField === 'name' && sortOrder) {
      filtered = filtered.sort((a, b) => {
        const letterA = getFirstLetter(a.name, isEnglish)
        const letterB = getFirstLetter(b.name, isEnglish)
        if (letterA !== letterB) {
          return sortOrder === 'asc' 
            ? letterA.localeCompare(letterB) 
            : letterB.localeCompare(letterA)
        }
        return sortOrder === 'asc' 
          ? a.name.localeCompare(b.name, isEnglish ? 'en' : 'zh')
          : b.name.localeCompare(a.name, isEnglish ? 'en' : 'zh')
      })
    }

    this.setData({
      filteredSeeds: filtered
    })
  },

  onSort(e) {
    const field = e.currentTarget.dataset.field
    let { currentSortField, sortOrder } = this.data

    if (currentSortField === field) {
      sortOrder = sortOrder === 'asc' ? 'desc' : (sortOrder === 'desc' ? '' : 'asc')
      if (!sortOrder) currentSortField = ''
    } else {
      currentSortField = field
      sortOrder = 'asc'
    }

    this.setData({
      currentSortField,
      sortOrder
    }, () => {
      this.filterData()
    })
  },


  onShareAppMessage() {
    return {
      title: 'SCUM园艺助手',
      path: '/packageGardening/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: 'SCUM园艺助手'
    }
  }
})
