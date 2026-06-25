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

  onShareAppMessage() {
    return {
      title: 'SCUM游戏工具箱 - 你的SCUM游戏伙伴',
      path: '/pages/index/index'
    }
  }
})
