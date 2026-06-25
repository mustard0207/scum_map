const app = getApp()

Page({
  data: {
    version: '1.0.0'
  },

  onLoad() {
    this.setData({
      version: app.globalData.version
    })
  },

  onShareAppMessage() {
    return {
      title: 'SCUM游戏工具箱 - 你的SCUM游戏伙伴',
      path: '/pages/index/index'
    }
  }
})
