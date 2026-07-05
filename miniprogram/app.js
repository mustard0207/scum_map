App({
  onLaunch() {
    console.log('SCUM游戏工具箱启动')
  },

  globalData: {
    // 地图配置
    mapConfig: {
      tileSize: 640,
      zoomLevels: [2, 4, 6],
      geoBoundingBox: {
        latitudeTop: 619199.938,
        latitudeBottom: -904800,
        longitudeLeft: 619200,
        longitudeRight: -904800
      }
    },

    // 版本信息
    version: '1.3.0'
  }
})
