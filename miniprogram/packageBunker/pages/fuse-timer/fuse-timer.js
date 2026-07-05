const app = getApp()

Page({
  data: {
    statusBarHeight: 20,
    
    amperage: 1000,
    durability: 100,
    
    isRunning: false,
    remainingMs: 0,
    totalMs: 0,
    
    timeDisplay: '00:00',
    estimateText: '20分00秒',
    alertLevel: 'idle', // idle, safe, warning, danger, dead
    showGuide: false,
    
    // 标记播放状态
    playedFlags: {
      '10m': false,
      '5m': false,
      '2m': false,
      '1m': false,
      '30s': false,
      '0s': false
    }
  },

  timerId: null,
  startTimestamp: 0,
  startRemainingMs: 0,

  // 音频实例字典
  audioContexts: {},

  onLoad() {
    const sysInfo = wx.getSystemInfoSync()
    const guideShown = wx.getStorageSync('bunkerTimerGuideShown')
    
    this.setData({ 
      statusBarHeight: sysInfo.statusBarHeight,
      showGuide: !guideShown
    })
    
    // 初始化所有音频
    this.initAudio()
    
    // 初始化计算
    this.recalculateTotalTime()
  },

  onShow() {
    // 强制屏幕常亮
    wx.setKeepScreenOn({
      keepScreenOn: true,
      fail: (err) => console.log('屏幕常亮设置失败', err)
    })
    
    // 如果是从后台切回来且正在运行，为了防止 setInterval 漂移，重新对齐时间戳
    if (this.data.isRunning) {
      this.startTick()
    }
  },

  onHide() {
    // 页面隐藏时清理定时器，依靠下次 onShow 用时间戳重新计算
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  },

  onUnload() {
    wx.setKeepScreenOn({ keepScreenOn: false })
    if (this.timerId) clearInterval(this.timerId)
    
    // 销毁音频
    Object.values(this.audioContexts).forEach(ctx => ctx.destroy())
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  closeGuide() {
    wx.vibrateShort()
    this.setData({ showGuide: false })
    wx.setStorageSync('bunkerTimerGuideShown', true)
  },

  openGuide() {
    wx.vibrateShort()
    this.setData({ showGuide: true })
  },

  // 页面分享设定
  onShareAppMessage() {
    return {
      title: 'SCUM 地堡保险丝计时器',
      path: '/packageBunker/pages/fuse-timer/fuse-timer'
    }
  },

  onShareTimeline() {
    return {
      title: 'SCUM 地堡保险丝计时器'
    }
  },

  initAudio() {
    const audios = ['start', '10m', '5m', '2m', '1m', '30s', '0s']
    audios.forEach(name => {
      const ctx = wx.createInnerAudioContext()
      ctx.src = `/assets/audio/${name}.wav`
      this.audioContexts[name] = ctx
    })
  },

  playAudio(name) {
    if (this.audioContexts[name]) {
      this.audioContexts[name].stop()
      this.audioContexts[name].play()
    }
  },

  setAmperage(e) {
    if (this.data.isRunning) return
    wx.vibrateShort()
    const val = parseInt(e.currentTarget.dataset.val)
    this.setData({ amperage: val }, () => {
      this.recalculateTotalTime()
    })
  },

  stepDurability(e) {
    if (this.data.isRunning) return
    wx.vibrateShort()
    const step = parseInt(e.currentTarget.dataset.val)
    let newDurability = this.data.durability + step
    if (newDurability > 100) newDurability = 100
    if (newDurability < 1) newDurability = 1
    
    this.setData({ durability: newDurability }, () => {
      this.recalculateTotalTime()
    })
  },

  recalculateTotalTime() {
    // 200A = 4 mins = 240 seconds
    const { amperage, durability } = this.data
    const baseSeconds = (amperage / 200) * 240
    const totalSeconds = Math.floor(baseSeconds * (durability / 100))
    const totalMs = totalSeconds * 1000
    
    // 格式化预估文字
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    
    this.setData({
      totalMs: totalMs,
      remainingMs: totalMs,
      estimateText: `${m}分${s < 10 ? '0' + s : s}秒`,
      alertLevel: 'idle'
    })
    
    this.resetPlayedFlags()
    this.updateDisplayTime()
  },

  resetPlayedFlags() {
    const ms = this.data.totalMs
    this.setData({
      playedFlags: {
        '10m': ms < 10 * 60 * 1000,
        '5m': ms < 5 * 60 * 1000,
        '2m': ms < 2 * 60 * 1000,
        '1m': ms < 1 * 60 * 1000,
        '30s': ms < 30 * 1000,
        '0s': ms <= 0
      }
    })
  },

  toggleTimer() {
    wx.vibrateShort()
    if (this.data.remainingMs <= 0) return // 没电了不准开

    if (this.data.isRunning) {
      // 暂停
      this.setData({ isRunning: false })
      if (this.timerId) {
        clearInterval(this.timerId)
        this.timerId = null
      }
    } else {
      // 启动
      this.playAudio('start')
      this.setData({ isRunning: true })
      this.startRemainingMs = this.data.remainingMs
      this.startTimestamp = Date.now()
      this.startTick()
    }
  },

  resetTimer() {
    wx.vibrateShort()
    if (this.timerId) {
      clearInterval(this.timerId)
      this.timerId = null
    }
    this.setData({ isRunning: false })
    this.recalculateTotalTime()
  },

  startTick() {
    if (this.timerId) clearInterval(this.timerId)
    
    this.timerId = setInterval(() => {
      const now = Date.now()
      const passed = now - this.startTimestamp
      let newRemaining = this.startRemainingMs - passed
      
      if (newRemaining <= 0) {
        newRemaining = 0
        clearInterval(this.timerId)
        this.timerId = null
        this.setData({ isRunning: false })
      }
      
      this.setData({ remainingMs: newRemaining })
      this.updateDisplayTime()
      this.checkAudioTriggers()
      
    }, 100) // 100ms 刷新一次界面
  },

  updateDisplayTime() {
    const ms = this.data.remainingMs
    if (ms <= 0) {
      this.setData({ timeDisplay: '00:00', alertLevel: 'dead' })
      return
    }
    
    const totalSeconds = Math.ceil(ms / 1000)
    const m = Math.floor(totalSeconds / 60)
    const s = totalSeconds % 60
    
    const timeDisplay = `${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`
    
    let alertLevel = 'safe'
    if (totalSeconds <= 30) {
      alertLevel = 'danger'
    } else if (totalSeconds <= 60) {
      alertLevel = 'warning'
    }

    // 没启动时，除非没电，否则显示为 idle 或 safe
    if (!this.data.isRunning && alertLevel === 'safe') {
      alertLevel = 'idle'
    }
    
    // 如果刚开启但剩余时间很大
    if (this.data.isRunning && alertLevel === 'idle') {
      alertLevel = 'safe'
    }

    this.setData({ timeDisplay, alertLevel })
  },

  checkAudioTriggers() {
    const ms = this.data.remainingMs
    const flags = this.data.playedFlags
    let updated = false
    const newFlags = { ...flags }

    const trigger = (thresholdMs, flagKey) => {
      if (ms <= thresholdMs && ms > 0 && !flags[flagKey]) {
        this.playAudio(flagKey)
        newFlags[flagKey] = true
        updated = true
      }
    }

    trigger(10 * 60 * 1000, '10m')
    trigger(5 * 60 * 1000, '5m')
    trigger(2 * 60 * 1000, '2m')
    trigger(1 * 60 * 1000, '1m')
    trigger(30 * 1000, '30s')

    // 0s
    if (ms <= 0 && !flags['0s']) {
      this.playAudio('0s')
      newFlags['0s'] = true
      updated = true
    }

    if (updated) {
      this.setData({ playedFlags: newFlags })
    }
  }
})
