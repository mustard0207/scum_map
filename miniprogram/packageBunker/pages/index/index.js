const app = getApp()

Page({
  data: {
    statusBarHeight: 0
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight
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

  onShareAppMessage() {
    return {
      title: 'SCUM 地堡工具箱',
      path: '/packageBunker/pages/index/index'
    }
  },

  onShareTimeline() {
    return {
      title: 'SCUM 地堡工具箱'
    }
  },

  goToCardReader() {
    wx.navigateTo({
      url: '/packageBunker/pages/card-reader/card-reader'
    })
  },

  goToFuseTimer() {
    wx.navigateTo({
      url: '/packageBunker/pages/fuse-timer/fuse-timer'
    })
  },

  showComingSoon() {
    wx.showToast({
      title: '正在开发中...',
      icon: 'none'
    })
  }
})
