const app = getApp()

// 预设模板
const TEMPLATES = [
  { type: 'smoke', name: '熏肉', emoji: '🥩', defaultMinutes: 960 },
  { type: 'plant', name: '种植', emoji: '🌱', defaultMinutes: 120 }
]

// 存储键
const STORAGE_KEY = 'scum_timer_data'

// 白天时间段（6:00 - 22:00）
const DAY_START = 6 * 60
const DAY_END = 22 * 60

Page({
  data: {
    statusBarHeight: 20,
    scrollAreaTop: 238,
    showGuide: false,

    // 倍率
    multiplier: 3.84,

    // 时钟
    clockCalibrated: false,
    clockDisplay: '--:--',
    isDaytime: true,
    timeToDawn: '',

    // 任务
    tasks: [],

    // 弹窗
    showAddModal: false,
    showTimePicker: false,
    showMultiplierModal: false,
    showCalibrateModal: false,
    tempMultiplier: '',
    templates: TEMPLATES,

    // 校准输入
    calibrateHourInput: '',
    calibrateMinuteInput: '',
    calibratePlaceholderHour: '00',
    calibratePlaceholderMinute: '00',
    focusCalibrateHour: false,
    focusCalibrateMinute: false,

    // 任务时长输入
    taskHourInput: '',
    taskMinuteInput: '',
    taskPlaceholderHour: '00',
    taskPlaceholderMinute: '00',
    focusTaskHour: false,
    focusTaskMinute: false,
    realDurationDisplay: '',

    // 编辑状态
    editingTaskId: null,
    pendingTemplate: null
  },

  _timerId: null,
  _clockTimerId: null,

  // ==================== 生命周期 ====================

  onLoad() {
    const sysInfo = wx.getWindowInfo()
    const guideShown = wx.getStorageSync('timerGuideShown')
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      showGuide: !guideShown
    })
    this._initStorageData()
    this._loadFromStorage()
    this._updateRealDurationDisplay()
  },

  onReady() {
    // 延迟获取固定区域实际高度，确保布局稳定
    setTimeout(() => {
      const query = this.createSelectorQuery()
      query.select('.fixed-area').boundingClientRect(rect => {
        if (rect) {
          // top 是从视口顶部的距离，加上自身高度就是滚动区域的起始位置
          this.setData({ scrollAreaTop: rect.top + rect.height })
        }
      }).exec()
    }, 100)
  },

  onShow() {
    this._startTimers()
    this._recalcAll()
  },

  onHide() {
    this._stopTimers()
  },

  onUnload() {
    this._stopTimers()
  },

  // ==================== 定时器 ====================

  _startTimers() {
    this._stopTimers()
    // 1秒刷新时钟和倒计时
    this._timerId = setInterval(() => {
      this._recalcAll()
    }, 1000)
  },

  _stopTimers() {
    if (this._timerId) {
      clearInterval(this._timerId)
      this._timerId = null
    }
  },

  // ==================== 重新计算 ====================

  _recalcAll() {
    this._recalcClock()
    this._recalcTasks()
  },

  // ==================== 游戏时钟 ====================

  _recalcClock() {
    const { clock, multiplier } = this._storageData
    if (!clock) {
      this.setData({ clockCalibrated: false, clockDisplay: '--:--', isDaytime: true, timeToDawn: '' })
      return
    }

    const now = Date.now()
    const elapsedMs = now - clock.realTimestamp
    const elapsedGameMs = elapsedMs * multiplier
    const elapsedGameMinutes = elapsedGameMs / 60000

    // 当前游戏时间（分钟数）
    let gameMinutes = (clock.gameMinutes + elapsedGameMinutes) % (24 * 60)
    if (gameMinutes < 0) gameMinutes += 24 * 60

    const hours = Math.floor(gameMinutes / 60)
    const mins = Math.floor(gameMinutes % 60)
    const clockDisplay = String(hours).padStart(2, '0') + ':' + String(mins).padStart(2, '0')

    // 白天/黑夜判断
    const isDaytime = gameMinutes >= DAY_START && gameMinutes < DAY_END

    // 距离天亮/天黑时间
    let timeToDawn = ''
    if (isDaytime) {
      // 白天：计算距离22:00还有多久
      const minutesToNight = DAY_END - gameMinutes
      const gh = Math.floor(minutesToNight / 60)
      const gm = Math.floor(minutesToNight % 60)
      const realMinToNight = minutesToNight / multiplier
      const rh = Math.floor(realMinToNight / 60)
      const rm = Math.ceil(realMinToNight % 60)
      const gameStr = gh > 0 ? `${gh}h${gm}m` : `${gm}m`
      const realStr = rh > 0 ? `${rh}h${rm}m` : `${rm}m`
      timeToDawn = `约 ${gameStr}（现实 ${realStr}）`
    } else {
      // 黑夜：计算距离6:00还有多久
      let minutesToDawn
      if (gameMinutes >= DAY_END) {
        minutesToDawn = (24 * 60 - gameMinutes) + DAY_START
      } else {
        minutesToDawn = DAY_START - gameMinutes
      }
      const gh = Math.floor(minutesToDawn / 60)
      const gm = Math.floor(minutesToDawn % 60)
      const realMinToDawn = minutesToDawn / multiplier
      const rh = Math.floor(realMinToDawn / 60)
      const rm = Math.ceil(realMinToDawn % 60)
      const gameStr = gh > 0 ? `${gh}h${gm}m` : `${gm}m`
      const realStr = rh > 0 ? `${rh}h${rm}m` : `${rm}m`
      timeToDawn = `约 ${gameStr}（现实 ${realStr}）`
    }

    this.setData({ clockCalibrated: true, clockDisplay, isDaytime, timeToDawn })
  },

  // ==================== 校准 ====================

  onCalibrateTap() {
    wx.vibrateShort({ type: 'light' })
    // 计算当前游戏时间作为 placeholder 提示
    let placeholderHour = '00'
    let placeholderMinute = '00'
    const { clock, multiplier } = this._storageData
    if (clock) {
      const now = Date.now()
      const elapsedMs = now - clock.realTimestamp
      const elapsedGameMinutes = (elapsedMs * multiplier) / 60000
      let gameMinutes = (clock.gameMinutes + elapsedGameMinutes) % (24 * 60)
      if (gameMinutes < 0) gameMinutes += 24 * 60
      placeholderHour = String(Math.floor(gameMinutes / 60)).padStart(2, '0')
      placeholderMinute = String(Math.floor(gameMinutes % 60)).padStart(2, '0')
    }
    this.setData({
      showCalibrateModal: true,
      calibrateHourInput: '',
      calibrateMinuteInput: '',
      calibratePlaceholderHour: placeholderHour,
      calibratePlaceholderMinute: placeholderMinute,
      focusCalibrateHour: true,
      focusCalibrateMinute: false
    })
  },

  hideCalibrateModal() {
    this.setData({ showCalibrateModal: false })
  },

  onCalibrateHourInput(e) {
    let val = e.detail.value.replace(/[^0-9]/g, '')
    if (val.length > 2) val = val.slice(0, 2)
    if (parseInt(val) > 23) val = '23'
    const update = { calibrateHourInput: val }
    // 输入2位自动跳到分钟
    if (val.length === 2) {
      update.focusCalibrateHour = false
      update.focusCalibrateMinute = true
    }
    this.setData(update)
  },

  onCalibrateMinuteInput(e) {
    let val = e.detail.value.replace(/[^0-9]/g, '')
    if (val.length > 2) val = val.slice(0, 2)
    if (val !== '' && parseInt(val) > 59) val = '59'
    this.setData({ calibrateMinuteInput: val })
  },

  onConfirmCalibrate() {
    const hourStr = this.data.calibrateHourInput.trim()
    const minuteStr = this.data.calibrateMinuteInput.trim()

    if (!hourStr) {
      this.setData({ showCalibrateModal: false })
      return
    }

    let hour = parseInt(hourStr)
    let minute = minuteStr ? parseInt(minuteStr) : 0

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      wx.showToast({ title: '时 0~23，分 0~59', icon: 'none' })
      return
    }

    wx.vibrateShort({ type: 'medium' })
    const gameMinutes = hour * 60 + minute
    this._storageData.clock = {
      gameMinutes: gameMinutes,
      realTimestamp: Date.now()
    }
    this._saveToStorage()
    this._recalcClock()
    this.setData({ showCalibrateModal: false })
    wx.showToast({ title: '校准成功', icon: 'success' })
  },

  // ==================== 倍率 ====================

  onMultiplierTap() {
    wx.vibrateShort({ type: 'light' })
    this.setData({ showMultiplierModal: true, tempMultiplier: '' })
  },

  hideMultiplierModal() {
    this.setData({ showMultiplierModal: false })
  },

  onTempMultiplierInput(e) {
    // 只保留数字和小数点，且最多一个小数点
    let filtered = e.detail.value.replace(/[^0-9.]/g, '')
    const parts = filtered.split('.')
    if (parts.length > 2) filtered = parts[0] + '.' + parts.slice(1).join('')
    this.setData({ tempMultiplier: filtered })
  },

  onConfirmMultiplier() {
    const input = this.data.tempMultiplier.trim()

    // 未输入，直接关闭
    if (!input) {
      this.setData({ showMultiplierModal: false })
      return
    }

    // 校验：只能有一个小数点，且能解析为正数
    if ((input.match(/\./g) || []).length > 1 || isNaN(Number(input)) || Number(input) <= 0) {
      wx.showToast({ title: '请输入有效的正数', icon: 'none' })
      return
    }

    const val = parseFloat(input)

    // 值没变，直接关闭
    if (val === this.data.multiplier) {
      this.setData({ showMultiplierModal: false })
      return
    }

    wx.vibrateShort({ type: 'medium' })
    const oldMultiplier = this._storageData.multiplier
    this._storageData.multiplier = val

    // 自动调整未完成任务的 endTime
    // 公式：endTime += gameMinutes * 60000 * (1/新倍率 - 1/旧倍率)
    const now = Date.now()
    this._storageData.tasks.forEach(task => {
      if (task.endTime > now) {
        task.endTime += task.gameMinutes * 60000 * (1 / val - 1 / oldMultiplier)
      }
    })

    this._saveToStorage()
    this._recalcClock()
    this._recalcTasks()
    this.setData({
      multiplier: val,
      showMultiplierModal: false
    })
    wx.showToast({ title: '倍率已更新，游戏时钟和已有任务提醒已自动调整', icon: 'success' })
  },

  // ==================== 任务管理 ====================

  onAddTask() {
    wx.vibrateShort({ type: 'light' })
    this.setData({ showAddModal: true, editingTaskId: null })
  },

  hideAddModal() {
    this.setData({ showAddModal: false })
  },

  onSelectTemplate(e) {
    const index = e.currentTarget.dataset.index
    const template = TEMPLATES[index]
    const defaultMinutes = template.defaultMinutes

    this.setData({
      showAddModal: false,
      showTimePicker: true,
      pendingTemplate: template,
      taskHourInput: '',
      taskMinuteInput: '',
      taskPlaceholderHour: String(Math.floor(defaultMinutes / 60)),
      taskPlaceholderMinute: String(defaultMinutes % 60),
      focusTaskHour: true,
      focusTaskMinute: false,
      editingTaskId: null
    })
    this._updateRealDurationDisplay()
  },

  // 修改任务
  onEditTask(e) {
    wx.vibrateShort({ type: 'light' })
    const taskId = e.currentTarget.dataset.id
    const task = this._storageData.tasks.find(t => t.id === taskId)
    if (!task) return

    this.setData({
      showTimePicker: true,
      pendingTemplate: { type: task.type, name: task.name, emoji: task.emoji },
      taskHourInput: '',
      taskMinuteInput: '',
      taskPlaceholderHour: String(Math.floor(task.gameMinutes / 60)),
      taskPlaceholderMinute: String(task.gameMinutes % 60),
      focusTaskHour: true,
      focusTaskMinute: false,
      editingTaskId: taskId
    })
    this._updateRealDurationDisplay()
  },

  hideTimePicker() {
    this.setData({ showTimePicker: false, pendingTemplate: null, editingTaskId: null })
  },

  onTaskHourInput(e) {
    let val = e.detail.value.replace(/[^0-9]/g, '')
    if (val.length > 3) val = val.slice(0, 3)
    const update = { taskHourInput: val }
    if (val.length === 3) {
      update.focusTaskHour = false
      update.focusTaskMinute = true
    }
    this.setData(update)
    this._updateRealDurationDisplay()
  },

  onTaskMinuteInput(e) {
    let val = e.detail.value.replace(/[^0-9]/g, '')
    if (val.length > 2) val = val.slice(0, 2)
    if (val !== '' && parseInt(val) > 59) val = '59'
    this.setData({ taskMinuteInput: val })
    this._updateRealDurationDisplay()
  },

  _updateRealDurationDisplay() {
    const { taskHourInput, taskMinuteInput, multiplier } = this.data
    const h = parseInt(taskHourInput) || 0
    const m = parseInt(taskMinuteInput) || 0
    const gameMinutes = h * 60 + m

    if (gameMinutes <= 0) {
      this.setData({ realDurationDisplay: '' })
      return
    }

    const realMinutes = gameMinutes / multiplier
    const rh = Math.floor(realMinutes / 60)
    const rm = Math.ceil(realMinutes % 60)
    let display = ''
    if (rh > 0) display += rh + '小时'
    if (rm > 0) display += rm + '分钟'
    if (!display) display = '不到1分钟'

    this.setData({ realDurationDisplay: display })
  },

  onConfirmTime() {
    const hourStr = this.data.taskHourInput.trim()
    const minuteStr = this.data.taskMinuteInput.trim()

    if (!hourStr && !minuteStr) {
      this.setData({ showTimePicker: false, pendingTemplate: null, editingTaskId: null })
      return
    }

    const h = parseInt(hourStr) || 0
    const m = parseInt(minuteStr) || 0
    const gameMinutes = h * 60 + m

    if (gameMinutes <= 0) {
      wx.showToast({ title: '请输入有效的时长', icon: 'none' })
      return
    }

    wx.vibrateShort({ type: 'medium' })
    const { multiplier, pendingTemplate, editingTaskId } = this.data

    const realDurationMs = (gameMinutes / multiplier) * 60 * 1000
    const endTime = Date.now() + realDurationMs

    if (editingTaskId) {
      // 修改已有任务
      const task = this._storageData.tasks.find(t => t.id === editingTaskId)
      if (task) {
        task.gameMinutes = gameMinutes
        task.endTime = endTime
        // 修改后重置日历状态（因为时间变了）
        task.calendarAdded = false
      }
    } else {
      // 新增任务
      const task = {
        id: 't_' + Date.now(),
        type: pendingTemplate.type,
        name: pendingTemplate.name,
        emoji: pendingTemplate.emoji,
        gameMinutes: gameMinutes,
        endTime: endTime,
        calendarAdded: false
      }
      this._storageData.tasks.unshift(task)
    }

    this._saveToStorage()
    this._recalcTasks()
    this.setData({ showTimePicker: false, pendingTemplate: null, editingTaskId: null })
  },

  // 点击任务卡片
  onTaskTap(e) {
    // 暂无额外交互
  },

  // 删除任务
  onDeleteTask(e) {
    wx.vibrateShort({ type: 'light' })
    const taskId = e.currentTarget.dataset.id
    const task = this._storageData.tasks.find(t => t.id === taskId)
    if (!task) return

    let content = '确定删除「' + task.name + '」提醒？'
    if (task.calendarAdded) {
      content += '\n\n⚠️ 该事项已加入系统日历，删除卡片不会取消日历闹钟，需前往手机日历手动删除。'
    }

    wx.showModal({
      title: '删除提醒',
      content: content,
      cancelText: '删除',
      cancelColor: '#E85D3A',
      confirmText: '取消',
      success: (res) => {
        if (res.cancel) {
          this._storageData.tasks = this._storageData.tasks.filter(t => t.id !== taskId)
          this._saveToStorage()
          this._recalcTasks()
          wx.showToast({ title: '已删除', icon: 'success' })
        }
      }
    })
  },

  // 长按删除（保留兼容）
  onTaskLongPress(e) {
    this.onDeleteTask(e)
  },

  // ==================== 日历提醒 ====================

  onCalendarTap(e) {
    wx.vibrateShort({ type: 'light' })
    const taskId = e.currentTarget.dataset.id
    const task = this._storageData.tasks.find(t => t.id === taskId)
    if (!task) return

    // 已添加过，提示是否再次添加
    if (task.calendarAdded) {
      wx.showModal({
        title: '重新添加日历',
        content: '该提醒可能已添加到日历，是否再次尝试添加？',
        cancelText: '取消',
        confirmText: '添加',
        success: (res) => {
          if (res.confirm) {
            this._addToCalendar(task)
          }
        }
      })
      return
    }

    this._addToCalendar(task)
  },

  _addToCalendar(task) {
    const endTimeSec = Math.floor(task.endTime / 1000)

    wx.addPhoneCalendar({
      title: '[SCUM] ' + task.name + '完成提醒',
      startTime: endTimeSec,
      description: 'SCUM 时间助手提醒：' + task.name + '预计已完成，请及时处理。',
      alarm: 10,
      success: () => {
        task.calendarAdded = true
        this._saveToStorage()
        this._recalcTasks()
        wx.showToast({ title: '已添加到日历', icon: 'success' })
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.indexOf('deny') >= 0) {
          wx.showToast({ title: '请授权日历权限', icon: 'none' })
        }
      }
    })
  },

  // ==================== 倒计时计算 ====================

  _recalcTasks() {
    const now = Date.now()
    const tasks = (this._storageData.tasks || []).map(task => {
      const remainingMs = task.endTime - now
      let countdownDisplay = ''
      if (remainingMs <= 0) {
        countdownDisplay = '00:00:00'
      } else {
        const totalSec = Math.ceil(remainingMs / 1000)
        const h = Math.floor(totalSec / 3600)
        const m = Math.floor((totalSec % 3600) / 60)
        const s = totalSec % 60
        countdownDisplay = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
      }

      const endDate = new Date(task.endTime)
      const endDisplay = String(endDate.getHours()).padStart(2, '0') + ':' + String(endDate.getMinutes()).padStart(2, '0')

      return {
        ...task,
        remainingMs,
        countdownDisplay,
        endDisplay
      }
    })
    this.setData({ tasks })
  },

  // ==================== 存储 ====================

  _initStorageData() {
    this._storageData = {
      multiplier: 3.84,
      clock: null,
      tasks: []
    }
  },

  _loadFromStorage() {
    try {
      const saved = wx.getStorageSync(STORAGE_KEY)
      if (saved && typeof saved === 'object') {
        this._storageData = {
          multiplier: saved.multiplier || 3.84,
          clock: saved.clock || null,
          tasks: saved.tasks || []
        }
        this.setData({ multiplier: this._storageData.multiplier })
      }
    } catch (e) {
      console.warn('[Timer] 加载失败:', e)
    }
  },

  _saveToStorage() {
    try {
      wx.setStorageSync(STORAGE_KEY, this._storageData)
    } catch (e) {
      console.warn('[Timer] 保存失败:', e)
    }
  },

  // ==================== 导航 ====================

  closeGuide() {
    this.setData({ showGuide: false })
    wx.setStorageSync('timerGuideShown', true)
  },

  openGuide() {
    wx.vibrateShort({ type: 'light' })
    this.setData({ showGuide: true })
  },

  onShareAppMessage() {
    return {
      title: 'SCUM 时间助手 - 游戏时钟校准与任务提醒',
      path: '/packageTimer/pages/index/index'
    }
  },

  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({ delta: 1 })
    } else {
      wx.reLaunch({ url: '/pages/index/index' })
    }
  },

  noop() {}
})
