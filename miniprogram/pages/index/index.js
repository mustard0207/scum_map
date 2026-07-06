const app = getApp()

Page({
  data: {
    statusBarHeight: 0,
    version: '1.0.0'
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo()
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      version: app.globalData.version
    })
  },

  // 进入地图页
  goToMap() {
    wx.navigateTo({ url: '/packageMap/pages/map/map' })
  },

  // 进入地堡工具页
  goToBunker() {
    wx.navigateTo({ url: '/packageBunker/pages/index/index' })
  },

  // 进入武器查询页
  goToWeapons() {
    wx.navigateTo({ url: '/packageWeapons/pages/index/index' })
  },

  // 进入狩猎助手页
  goToHunting() {
    wx.navigateTo({ url: '/packageMap/pages/hunting/hunting' })
  },

  onShareAppMessage() {
    return {
      title: 'SCUM游戏工具箱 - 你的SCUM游戏伙伴',
      path: '/pages/index/index'
    }
  }
})
