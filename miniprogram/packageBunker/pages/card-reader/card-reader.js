Page({
  data: {
    statusBarHeight: 0,
    
    // 输入数据
    startValue: '',
    redTarget: '',
    blueTarget: '',
    redOps: ['', '', '', '', '', '', '', ''],
    blueOps: ['', '', '', '', '', '', '', ''],
    
    // UI状态
    leftCol: [0, 1, 2, 3],
    rightCol: [4, 5, 6, 7],
    currentFocus: 'startValue', // 当前输入焦点
    showResult: false,
    showError: false,
    resultArray: [], // 布尔数组，表示哪些开关开启
    resultCount: 0,
    showGuide: false
  },

  onLoad() {
    const sysInfo = wx.getWindowInfo()
    
    const guideShown = wx.getStorageSync('bunkerReaderGuideShown')
    this.setData({
      statusBarHeight: sysInfo.statusBarHeight,
      showGuide: !guideShown
    })
  },

  closeGuide() {
    wx.vibrateShort()
    this.setData({ showGuide: false })
    wx.setStorageSync('bunkerReaderGuideShown', true)
  },

  // 页面分享设定
  onShareAppMessage() {
    return {
      title: 'SCUM 废弃地堡计算器',
      path: '/packageBunker/pages/card-reader/card-reader'
    }
  },

  onShareTimeline() {
    return {
      title: 'SCUM 废弃地堡计算器'
    }
  },

  // 返回上一页
  goBack() {
    const pages = getCurrentPages()
    if (pages.length > 1) {
      wx.navigateBack({
        delta: 1
      })
    } else {
      // 如果是通过分享单页点进来，历史栈为空，则重定向回首页
      wx.reLaunch({
        url: '/pages/index/index'
      })
    }
  },

  validateCurrentFocus() {
    const focus = this.data.currentFocus
    if (!focus) return true
    
    // 只校验操作区 (r0~r7, b0~b7)
    if ((focus.startsWith('r') || focus.startsWith('b')) && focus.length === 2) {
      let isRed = focus.startsWith('r')
      let idx = parseInt(focus.substring(1))
      let val = isRed ? this.data.redOps[idx] : this.data.blueOps[idx]
      
      // 如果长度为1且是符号，说明漏了数字
      if (val && val.length === 1 && ['+', '-', '*', '/', 'x', '÷'].includes(val)) {
        wx.showToast({ title: '符号后需输入数字', icon: 'none' })
        wx.vibrateLong()
        return false
      }
    }
    return true
  },

  // 切换输入焦点
  setFocus(e) {
    wx.vibrateShort()
    if (!this.validateCurrentFocus()) return
    
    const id = e.currentTarget.dataset.id
    this.setData({ 
      currentFocus: id,
      showResult: false,
      showError: false
    })
  },

  // 自动跳到下一个输入框
  nextFocus(silent = false) {
    if (!this.validateCurrentFocus()) return
    
    if (silent !== true) {
      wx.vibrateShort()
    }
    const order = [
      'startValue', 'redTarget', 'blueTarget',
      'r0', 'b0', 'r1', 'b1', 'r2', 'b2', 'r3', 'b3',
      'r4', 'b4', 'r5', 'b5', 'r6', 'b6', 'r7', 'b7'
    ]
    const idx = order.indexOf(this.data.currentFocus)
    if (idx !== -1 && idx < order.length - 1) {
      this.setData({ currentFocus: order[idx + 1] })
    }
  },

  // 键盘输入字符
  inputChar(e) {
    wx.vibrateShort()
    const char = e.currentTarget.dataset.char
    const focus = this.data.currentFocus
    if (!focus) return

    const isOperator = ['+', '-', '*', '/', 'x', '÷'].includes(char)
    const isDigit = /[0-9]/.test(char)

    // 焦点在顶部3个基础框
    if (focus === 'startValue' || focus === 'redTarget' || focus === 'blueTarget') {
      if (isOperator) {
        wx.showToast({ title: '此处仅限输入数字', icon: 'none' })
        wx.vibrateLong()
        return
      }
      let currentVal = this.data[focus]
      this.setData({ [focus]: currentVal + char })
      return
    }

    // 焦点在操作区
    let currentVal = ''
    let isRed = focus.startsWith('r')
    let isBlue = focus.startsWith('b')
    let idx = parseInt(focus.substring(1))

    if (isRed) {
      currentVal = this.data.redOps[idx] || ''
    } else if (isBlue) {
      currentVal = this.data.blueOps[idx] || ''
    }

    if (isOperator) {
      if (currentVal.length === 0) {
        // 空的时候直接输入
        currentVal = char
      } else if (currentVal.length === 1 && ['+', '-', '*', '/', 'x', '÷'].includes(currentVal)) {
        // 只有符号时替换
        currentVal = char
      } else if (/[0-9]$/.test(currentVal)) {
        // 以数字结尾时，智能跳格并填入符号
        this.nextFocus(true)
        const newFocus = this.data.currentFocus
        if (newFocus && newFocus !== focus) {
           let nIsRed = newFocus.startsWith('r')
           let nIsBlue = newFocus.startsWith('b')
           let nIdx = parseInt(newFocus.substring(1))
           if (nIsRed) {
             const newOps = [...this.data.redOps]
             newOps[nIdx] = char
             this.setData({ redOps: newOps })
           } else if (nIsBlue) {
             const newOps = [...this.data.blueOps]
             newOps[nIdx] = char
             this.setData({ blueOps: newOps })
           }
        }
        return // 已经处理完毕，直接返回
      } else {
        currentVal += char
      }
    } else if (isDigit) {
      if (currentVal.length === 0) {
        wx.showToast({ title: '请先输入运算符号', icon: 'none' })
        wx.vibrateLong()
        return
      }
      currentVal += char
    }

    // 更新当前格数据
    if (isRed) {
      const newOps = [...this.data.redOps]
      newOps[idx] = currentVal
      this.setData({ redOps: newOps })
    } else if (isBlue) {
      const newOps = [...this.data.blueOps]
      newOps[idx] = currentVal
      this.setData({ blueOps: newOps })
    }
  },

  // 键盘退格
  backspace() {
    wx.vibrateShort()
    const focus = this.data.currentFocus
    if (!focus) return

    let currentVal = ''
    if (focus.startsWith('r') && focus.length === 2) {
      const idx = parseInt(focus[1])
      currentVal = this.data.redOps[idx]
      if (currentVal.length > 0) {
        const newOps = [...this.data.redOps]
        newOps[idx] = currentVal.slice(0, -1)
        this.setData({ redOps: newOps })
      }
    } else if (focus.startsWith('b') && focus.length === 2) {
      const idx = parseInt(focus[1])
      currentVal = this.data.blueOps[idx]
      if (currentVal.length > 0) {
        const newOps = [...this.data.blueOps]
        newOps[idx] = currentVal.slice(0, -1)
        this.setData({ blueOps: newOps })
      }
    } else {
      currentVal = this.data[focus]
      if (currentVal && currentVal.length > 0) {
        this.setData({ [focus]: currentVal.slice(0, -1) })
      }
    }
  },

  // 二次确认清空
  confirmReset() {
    wx.vibrateShort()
    wx.showModal({
      title: '⚠️ 确认清空',
      content: '确定要清空所有已输入的数据吗？',
      cancelText: '清空',
      cancelColor: '#ff4444',
      confirmText: '取消',
      confirmColor: '#333333',
      success: (res) => {
        if (res.cancel) {
          // 在微信弹窗中，cancel对应左侧按钮
          this.resetAll()
        }
      }
    })
  },

  // 全部清空
  resetAll() {
    wx.vibrateShort()
    this.setData({
      startValue: '', redTarget: '', blueTarget: '',
      redOps: ['', '', '', '', '', '', '', ''],
      blueOps: ['', '', '', '', '', '', '', ''],
      currentFocus: 'startValue',
      showResult: false,
      showError: false
    })
  },

  hideResult() {
    wx.vibrateShort()
    this.setData({
      showResult: false,
      showError: false
    })
  },

  // 辅助函数：执行单步算术运算
  evaluate(current, opStr) {
    if (!opStr || opStr.trim() === '') return current;
    const op = opStr.charAt(0);
    const num = parseFloat(opStr.substring(1));
    if (isNaN(num)) return current; // 解析失败忽略

    switch (op) {
      case '+': return current + num;
      case '-': return current - num;
      case '*': return current * num;
      case 'x': return current * num; // 兼容 'x'
      case '/': return current / num;
      case '÷': return current / num;
      default: return current;
    }
  },

  // 核心破解计算
  calculate() {
    wx.vibrateShort()
    if (!this.validateCurrentFocus()) return

    const { startValue, redTarget, blueTarget, redOps, blueOps } = this.data

    const rStart = parseFloat(startValue)
    const rTarget = parseFloat(redTarget)
    
    // 如果没有填目标，就直接报错
    if (isNaN(rStart) || isNaN(rTarget)) {
      wx.showToast({ title: '请输入初始值与红色通道目标值', icon: 'none' })
      return
    }

    // 判断是否是双通道 (只要蓝通道填了目标就算)
    const isDual = blueTarget.trim() !== ''
    const bStart = rStart // 蓝通道的初始值和红通道一样
    const bTarget = isDual ? parseFloat(blueTarget) : 0

    if (isDual && isNaN(bTarget)) {
      wx.showToast({ title: '双通道模式下请填写蓝通道完整数值', icon: 'none' })
      return
    }

    // 穷举 0~255 (2^8)
    let found = false
    let bestCombo = []

    for (let i = 0; i < 256; i++) {
      let currentRed = rStart
      let currentBlue = bStart
      let combo = []

      for (let bit = 0; bit < 8; bit++) {
        // 判断第 bit 位是否为 1 (开关是否开启)
        const isOn = (i & (1 << bit)) !== 0
        combo.push(isOn)

        if (isOn) {
          currentRed = this.evaluate(currentRed, redOps[bit])
          if (isDual) {
            currentBlue = this.evaluate(currentBlue, blueOps[bit])
          }
        }
      }

      // 验证是否满足条件 (允许极其微小的浮点误差)
      const redMatch = Math.abs(currentRed - rTarget) < 0.0001
      const blueMatch = isDual ? Math.abs(currentBlue - bTarget) < 0.0001 : true

      if (redMatch && blueMatch) {
        found = true
        bestCombo = combo
        break // 找到一个解就停止
      }
    }

    if (found) {
      const count = bestCombo.filter(v => v).length
      this.setData({
        showResult: true,
        showError: false,
        resultArray: bestCombo,
        resultCount: count,
        currentFocus: '' // 隐藏光标
      })
    } else {
      this.setData({
        showResult: false,
        showError: true,
        currentFocus: ''
      })
      // 错误结果使用长震动覆盖短震动
      wx.vibrateLong()
    }
  }
})
