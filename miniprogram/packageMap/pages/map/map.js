const app = getApp()

Page({
  data: {
    statusBarHeight: 0,
    bottomBarHeight: 0,
    coordLng: 0,
    coordLat: 0,
    showCoordInput: false,
    coordInputValue: '',
    zoomSliderPercent: 0,  // 缩放条位置百分比（0=底部最小，100=顶部最大）
    // 标记数组（传给组件）
    markers: [],
    // 当前选中的标记
    selectedMarker: null,
    selectedMarkerIndex: -1,
    // 信息窗口
    showInfoWindow: false,
    // 导入弹窗
    showImportDialog: false,
    importInputValue: '',
    // 备份抽屉
    showDataDrawer: false
  },

  onLoad(options) {
    const sysInfo = wx.getWindowInfo()
    if (sysInfo) this.setData({ statusBarHeight: sysInfo.statusBarHeight })

    setTimeout(() => {
      const query = wx.createSelectorQuery()
      query.select('#bottomBar').boundingClientRect(rect => {
        if (rect) {
          this.setData({ bottomBarHeight: rect.height })
          // 计算 map-area 实际高度并传给组件
          const sysInfo = wx.getWindowInfo()
          if (!sysInfo) return
          const navBarH = this.data.statusBarHeight + 44
          const mapH = sysInfo.windowHeight - navBarH - rect.height
          console.log(`[LayoutDebug] bottomBar: h=${rect.height} top=${rect.top} bottom=${rect.bottom} mapH=${mapH}`)
          this.selectComponent('#tileMap').recalcViewport(mapH)
        }
      }).exec()
    }, 100)

    // 接收分享链接跳转参数
    if (options.markers) {
      // 新格式：多个标记 markers=lng1,lat1,name1|lng2,lat2,name2|...
      const sharedMarkers = options.markers.split('|').map((item, i) => {
        const parts = item.split(',')
        return {
          id: 'shared_' + Date.now() + '_' + i,
          lng: parseFloat(parts[0]),
          lat: parseFloat(parts[1]),
          name: parts[2] ? decodeURIComponent(parts[2]) : ''
        }
      }).filter(m => !isNaN(m.lng) && !isNaN(m.lat))
      if (sharedMarkers.length > 0) {
        this.setData({ markers: sharedMarkers })
        // 跳转到最后一个标记的位置
        const last = sharedMarkers[sharedMarkers.length - 1]
        setTimeout(() => this.navigateToTarget(last.lng, last.lat), 600)
      }
    } else if (options.x && options.y) {
      // 旧格式兼容：单个标记 x=lng&y=lat&name=xxx
      const lng = parseFloat(options.x)
      const lat = parseFloat(options.y)
      const name = decodeURIComponent(options.name || '')
      const marker = { id: 'shared_' + Date.now(), lng, lat, name }
      this.setData({
        markers: [marker],
        selectedMarker: marker
      })
      setTimeout(() => this.navigateToTarget(lng, lat), 600)
    }
  },

  onShow() {
    // 启动坐标实时刷新（十字光标所在位置的坐标）
    this._coordTimer = setInterval(() => this._refreshCenterCoord(), 200)

    // 激活分享能力（必须先调用，wx.shareAppMessage 才能正常工作）
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] })
  },

  onHide() {
    clearInterval(this._coordTimer)
  },

  onUnload() {
    clearInterval(this._coordTimer)
    this.setData({ showImportDialog: false, showDataDrawer: false })
  },

  /** DEBUG: 检测点击位置 */
  onMapAreaTap(e) {
    const { clientX, clientY } = e.detail
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return
    const screenH = sysInfo.windowHeight
    console.log(`[TapDebug] x=${clientX} y=${clientY} screenH=${screenH} bottomBarH=${this.data.bottomBarHeight} distFromBottom=${screenH - clientY}`)
  },

  // ================================================================
  // 缩放拖拉条
  // ================================================================

  onZoomSliderStart(e) {
    this._sliderStartY = e.touches[0].clientY
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) {
      this._sliderStartScale = mapComp.getScale()
      this._sliderMinScale = mapComp.getMinScale()
    }
  },

  onZoomSliderMove(e) {
    if (this._sliderStartY === undefined) return
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return

    const minScale = this._sliderMinScale || 0.2
    const maxScale = 8
    const dy = this._sliderStartY - e.touches[0].clientY  // 上拉为正
    const sliderRange = 300  // 拖拉条有效像素范围（条越长精度越高）
    const scaleDelta = (dy / sliderRange) * (maxScale - minScale)
    const newScale = Math.max(minScale, Math.min(maxScale, this._sliderStartScale + scaleDelta))

    // 以十字光标（屏幕中心）为锚点缩放
    const cx = sysInfo.windowWidth / 2
    const cy = sysInfo.windowHeight / 2
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) mapComp.zoomTo(newScale, cx, cy)

    // 更新滑块位置
    const percent = ((newScale - minScale) / (maxScale - minScale)) * 100
    this.setData({ zoomSliderPercent: Math.max(0, Math.min(100, percent)) })
  },

  onZoomSliderEnd() {
    this._sliderStartY = undefined
    this._sliderStartScale = undefined
  },

  /** 刷新屏幕中心光标处的地理坐标 */
  _refreshCenterCoord() {
    const mapComp = this.selectComponent('#tileMap')
    if (!mapComp) return

    // 使用地图视口的中心坐标（相对于地图视口）
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return
    const mapViewportHeight = sysInfo.windowHeight - this.data.statusBarHeight - 44 - 70  // 减去状态栏、导航栏、底部栏
    const cx = sysInfo.windowWidth / 2
    const cy = mapViewportHeight / 2

    const geo = mapComp.screenToGeo(cx, cy)
    if (geo) {
      // 同步缩放条位置
      const scale = mapComp.getScale()
      const minScale = mapComp.getMinScale()
      const percent = ((scale - minScale) / (8 - minScale)) * 100
      this.setData({
        coordLng: geo.lng,
        coordLat: geo.lat,
        zoomSliderPercent: Math.max(0, Math.min(100, percent))
      })
    }
  },

  /** 点击"选点"：将当前十字光标位置标记为选中点 */
  placeMarker() {
    if (this.data.markers.length >= 50) {
      wx.showToast({ title: '最多支持50个标记', icon: 'none' })
      return
    }
    const mapComp = this.selectComponent('#tileMap')
    if (!mapComp) return

    // 使用地图视口的中心坐标
    const sysInfo = wx.getWindowInfo()
    if (!sysInfo) return
    const mapViewportHeight = sysInfo.windowHeight - this.data.statusBarHeight - 44 - 70
    const cx = sysInfo.windowWidth / 2
    const cy = mapViewportHeight / 2

    const geo = mapComp.screenToGeo(cx, cy)
    if (geo) {
      const newMarker = {
        id: 'user_' + Date.now(),
        lng: geo.lng,
        lat: geo.lat,
        name: ''
      }
      const markers = [...this.data.markers, newMarker]
      this.setData({
        markers,
        selectedMarker: newMarker,
        selectedMarkerIndex: -1,
        showInfoWindow: false
      })
      wx.vibrateShort({ type: 'medium' })
    }
  },

  /** 显示坐标输入框 */
  showCoordInput() {
    this.setData({ showCoordInput: true, coordInputValue: '' })
  },

  /** 隐藏坐标输入框 */
  hideCoordInput() {
    this.setData({ showCoordInput: false })
  },

  /** 空方法：阻止事件冒泡（用于 catchtap） */
  noop() {},

  /** 坐标输入框内容变化 */
  onCoordInputChange(e) {
    this.setData({ coordInputValue: e.detail.value })
  },

  /** 跳转到输入的坐标 */
  jumpToCoord() {
    if (this.data.markers.length >= 50) {
      wx.showToast({ title: '最多支持50个标记', icon: 'none' })
      return
    }
    const input = this.data.coordInputValue
    console.log('jumpToCoord input:', input)
    if (!input) {
      wx.showToast({ title: '请输入坐标', icon: 'none' })
      return
    }

    const coord = this._parseCoordInput(input)
    console.log('jumpToCoord parsed:', coord)
    if (!coord) {
      wx.showToast({ title: '坐标格式错误', icon: 'none' })
      return
    }

    const mapComp = this.selectComponent('#tileMap')
    console.log('mapComp:', mapComp)
    if (!mapComp) return

    // 检查坐标是否在范围内
    const inBounds = mapComp.isInBounds(coord.lng, coord.lat)
    console.log('inBounds:', inBounds)
    if (!inBounds) {
      wx.showToast({ title: '坐标超出地图范围', icon: 'none' })
      return
    }

    // 跳转到坐标并添加标记
    const success = mapComp.moveToGeo(coord.lng, coord.lat)
    console.log('moveToGeo success:', success)
    if (success) {
      const newMarker = {
        id: 'input_' + Date.now(),
        lng: coord.lng,
        lat: coord.lat,
        name: ''
      }
      const markers = [...this.data.markers, newMarker]
      console.log('new markers:', markers)
      this.setData({
        markers,
        selectedMarker: newMarker,
        selectedMarkerIndex: -1,
        showInfoWindow: false,
        showCoordInput: false
      })
      wx.vibrateShort({ type: 'medium' })
    }
  },

  /** 解析坐标输入 */
  _parseCoordInput(input) {
    // 格式1：游戏原始格式 {X=19079.908 Y=-687946.000 Z=873.744|...}
    const gameFormat = input.match(/X=\s*([-\d.]+)\s+Y=\s*([-\d.]+)/i)
    if (gameFormat) {
      return {
        lng: parseFloat(gameFormat[1]),
        lat: parseFloat(gameFormat[2])
      }
    }

    // 格式2：简单格式 19079.908, -687946.000 或 19079.908 -687946.000
    const simpleFormat = input.match(/([-\d.]+)\s*[,\s]\s*([-\d.]+)/)
    if (simpleFormat) {
      return {
        lng: parseFloat(simpleFormat[1]),
        lat: parseFloat(simpleFormat[2])
      }
    }

    return null
  },

  /** 标记点击事件 */
  onMarkerTap(e) {
    const marker = e.detail.marker
    if (marker) {
      const idx = this.data.markers.findIndex(m => m.id === marker.id)
      this.setData({
        selectedMarker: marker,
        selectedMarkerIndex: idx,
        showInfoWindow: true
      })
    }
  },

  /** 关闭信息窗口 */
  closeInfoWindow() {
    this.setData({ showInfoWindow: false, selectedMarkerIndex: -1 })
  },

  /** 复制当前选中标记的坐标 */
  copyCoord() {
    const marker = this.data.selectedMarker
    if (!marker) return
    wx.setClipboardData({
      data: `{X=${marker.lng} Y=${marker.lat} Z=0}`,
      success: () => wx.showToast({ title: '坐标已复制' })
    })
  },

  /** 删除当前选中的标记 */
  deleteMarker() {
    if (!this.data.selectedMarker) return
    const markerId = this.data.selectedMarker.id
    const markers = this.data.markers.filter(m => m.id !== markerId)
    this.setData({
      markers,
      selectedMarker: null,
      selectedMarkerIndex: -1,
      showInfoWindow: false
    })
  },

  /** 重置视图（含清除标记） */
  resetView() {
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) mapComp.resetView()
    this.setData({ markers: [], selectedMarker: null, selectedMarkerIndex: -1, showInfoWindow: false })
  },

  /** 仅重置地图视角（保留标记） */
  resetMapView() {
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp) mapComp.resetView()
  },

  // ========== 导入导出（二进制紧凑格式） ==========

  /** 字符串 → UTF-8 字节数组 */
  _strToBytes(str) {
    const uri = encodeURIComponent(str)
    const bytes = []
    for (let i = 0; i < uri.length; i++) {
      if (uri[i] === '%') {
        bytes.push(parseInt(uri.substr(i + 1, 2), 16))
        i += 2
      } else {
        bytes.push(uri.charCodeAt(i))
      }
    }
    return bytes
  },

  /** UTF-8 字节数组 → 字符串 */
  _bytesToStr(bytes) {
    let uri = ''
    for (let i = 0; i < bytes.length; i++) {
      uri += '%' + ('0' + bytes[i].toString(16)).slice(-2)
    }
    return decodeURIComponent(uri)
  },

  /** 写入有符号 40 位整数（5 字节，小端序） */
  _writeInt40(bytes, value) {
    let v = Math.round(value)
    const sign = v < 0 ? 1 : 0
    if (v < 0) v = -v
    const lo32 = v >>> 0
    const hi8 = ((v / 0x100000000) >>> 0) & 0x7F
    bytes.push((lo32) & 0xFF)
    bytes.push((lo32 >> 8) & 0xFF)
    bytes.push((lo32 >> 16) & 0xFF)
    bytes.push((lo32 >> 24) & 0xFF)
    bytes.push(hi8 | (sign ? 0x80 : 0))
  },

  /** 读取有符号 40 位整数 */
  _readInt40(bytes, offset) {
    const b0 = bytes[offset]
    const b1 = bytes[offset + 1]
    const b2 = bytes[offset + 2]
    const b3 = bytes[offset + 3]
    const b4 = bytes[offset + 4]
    const lo32 = b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)
    const hi8 = b4 & 0x7F
    const sign = (b4 & 0x80) ? -1 : 1
    const value = sign * (hi8 * 0x100000000 + (lo32 >>> 0))
    return value
  },

  /** Zigzag 编码：有符号 → 无符号（支持超出 32 位） */
  _zigzagEncode(value) {
    return value >= 0 ? value * 2 : value * -2 - 1
  },

  /** Zigzag 解码：无符号 → 有符号（支持超出 32 位） */
  _zigzagDecode(value) {
    return (value & 1) === 0 ? value / 2 : -(value + 1) / 2
  },

  /** 写入无符号 varint（7 位/字节，小端序，支持超出 32 位） */
  _writeVarint(bytes, value) {
    let v = Math.floor(value)
    while (v > 0x7F) {
      bytes.push((v & 0x7F) | 0x80)
      v = Math.floor(v / 128)
    }
    bytes.push(v & 0x7F)
  },

  /** 读取无符号 varint，返回 [值, 消耗字节数]（支持超出 32 位） */
  _readVarint(bytes, offset) {
    let result = 0
    let factor = 1
    let pos = offset
    while (pos < bytes.length) {
      const b = bytes[pos]
      result += (b & 0x7F) * factor
      pos++
      if ((b & 0x80) === 0) break
      factor *= 128
    }
    return [result, pos - offset]
  },

  /**
   * 编码标记为二进制紧凑格式
   * 格式：'S' + count(1B) + 绝对坐标(10B) + 偏移(varint)...
   * 坐标精度：4 位小数（×10000）
   * 前缀：SCUM#
   */
  _encodeMarkers(markers) {
    const bytes = []
    bytes.push(0x53) // 'S' — 版本标识
    bytes.push(markers.length & 0xFF)

    for (let i = 0; i < markers.length; i++) {
      const m = markers[i]
      const lngInt = Math.round(m.lng * 10000)
      const latInt = Math.round(m.lat * 10000)

      if (i === 0) {
        // 第 1 个标记：绝对坐标
        this._writeInt40(bytes, lngInt)
        this._writeInt40(bytes, latInt)
      } else {
        // 后续标记：偏移量 zigzag + varint
        const prev = markers[i - 1]
        const dLng = lngInt - Math.round(prev.lng * 10000)
        const dLat = latInt - Math.round(prev.lat * 10000)
        this._writeVarint(bytes, this._zigzagEncode(dLng))
        this._writeVarint(bytes, this._zigzagEncode(dLat))
      }

      // 名字：长度前缀 + UTF-8
      const nameBytes = this._strToBytes(m.name || '')
      this._writeVarint(bytes, nameBytes.length)
      for (let j = 0; j < nameBytes.length; j++) bytes.push(nameBytes[j])
    }

    const ab = new ArrayBuffer(bytes.length)
    const view = new Uint8Array(ab)
    for (let i = 0; i < bytes.length; i++) view[i] = bytes[i]
    return 'SCUM#' + wx.arrayBufferToBase64(ab)
  },

  /**
   * 解码标记（支持新二进制格式 + 旧文本格式）
   */
  _decodeMarkers(code) {
    if (!code || !code.startsWith('SCUM#')) return null
    try {
      const payload = code.substring(5)
      const ab = wx.base64ToArrayBuffer(payload)
      const bytes = new Uint8Array(ab)

      // 检查是否为新二进制格式（首字节 'S' = 0x53）
      if (bytes.length > 1 && bytes[0] === 0x53) {
        return this._decodeBinaryMarkers(bytes)
      }

      // 回退：旧文本格式
      return this._decodeTextMarkers(bytes)
    } catch (e) {
      return null
    }
  },

  /** 解码二进制格式标记 */
  _decodeBinaryMarkers(bytes) {
    const count = bytes[1]
    if (count === 0) return []
    const markers = []
    let pos = 2
    let prevLngInt = 0
    let prevLatInt = 0

    for (let i = 0; i < count && pos < bytes.length; i++) {
      let lngInt, latInt

      if (i === 0) {
        lngInt = this._readInt40(bytes, pos); pos += 5
        latInt = this._readInt40(bytes, pos); pos += 5
      } else {
        const [dLngRaw, c1] = this._readVarint(bytes, pos); pos += c1
        const [dLatRaw, c2] = this._readVarint(bytes, pos); pos += c2
        lngInt = prevLngInt + this._zigzagDecode(dLngRaw)
        latInt = prevLatInt + this._zigzagDecode(dLatRaw)
      }

      prevLngInt = lngInt
      prevLatInt = latInt

      // 读取名字
      const [nameLen, c3] = this._readVarint(bytes, pos); pos += c3
      let name = ''
      if (nameLen > 0 && pos + nameLen <= bytes.length) {
        name = this._bytesToStr(bytes.slice(pos, pos + nameLen))
        pos += nameLen
      }

      markers.push({
        id: 'imported_' + Date.now() + '_' + i,
        lng: lngInt / 10000,
        lat: latInt / 10000,
        name
      })
    }
    return markers
  },

  /** 解码旧文本格式标记（兼容） */
  _decodeTextMarkers(bytes) {
    const payload = this._bytesToStr(bytes)
    if (!payload) return null
    return payload.split('|').map(item => {
      const atIdx = item.lastIndexOf('@')
      let name = '', coordStr = item
      if (atIdx > 0) {
        const afterAt = item.substring(atIdx + 1)
        if (/^-?[\d.]+,-?[\d.]+$/.test(afterAt)) {
          name = item.substring(0, atIdx)
          coordStr = afterAt
        }
      }
      const parts = coordStr.split(',')
      if (parts.length < 2) return null
      const lng = parseFloat(parts[0])
      const lat = parseFloat(parts[1])
      if (isNaN(lng) || isNaN(lat)) return null
      return { id: 'imported_' + Date.now() + '_' + Math.random(), lng, lat, name }
    }).filter(Boolean)
  },

  // ========== 备份抽屉 & 筛选 ==========

  /** 显示备份抽屉 */
  showDataDrawer() {
    this.setData({ showDataDrawer: true })
  },

  /** 隐藏备份抽屉 */
  hideDataDrawer() {
    this.setData({ showDataDrawer: false })
  },

  /** 抽屉 — 导入 */
  onDrawerImport() {
    this.setData({ showDataDrawer: false })
    setTimeout(() => this.showImportDialog(), 200)
  },

  /** 抽屉 — 导出 */
  onDrawerExport() {
    this.setData({ showDataDrawer: false })
    setTimeout(() => this.exportMarkers(), 200)
  },

  /** 筛选按钮（二期实现） */
  onFilterTap() {
    wx.showToast({ title: '筛选功能即将开放', icon: 'none' })
  },

  /** 显示导入弹窗 */
  showImportDialog() {
    this.setData({ showImportDialog: true, importInputValue: '' })
  },

  /** 隐藏导入弹窗 */
  hideImportDialog() {
    this.setData({ showImportDialog: false })
  },

  /** 导入输入框内容变化 */
  onImportInputChange(e) {
    this.setData({ importInputValue: e.detail.value })
  },

  /** 导入标记 */
  importMarkers() {
    const code = this.data.importInputValue.trim()
    if (!code) {
      wx.showToast({ title: '请粘贴标记代码', icon: 'none' })
      return
    }
    const decoded = this._decodeMarkers(code)
    if (!decoded || decoded.length === 0) {
      wx.showToast({ title: '无效的标记代码', icon: 'none' })
      return
    }

    const doImport = (markers) => {
      let truncated = false
      if (markers.length > 50) {
        markers = markers.slice(0, 50)
        truncated = true
      }
      this.setData({
        markers,
        selectedMarker: null,
        selectedMarkerIndex: -1,
        showInfoWindow: false,
        showImportDialog: false
      })
      wx.vibrateShort({ type: 'medium' })
      if (truncated) {
        wx.showToast({ title: '最多50个，已截取前50个', icon: 'none', duration: 2000 })
      } else {
        wx.showToast({ title: `已导入 ${markers.length} 个标记` })
      }
    }

    if (this.data.markers.length > 0) {
      wx.showModal({
        title: '导入标记',
        content: `当前有 ${this.data.markers.length} 个标记，导入将替换，确定？`,
        success: (res) => {
          if (res.confirm) doImport(decoded)
          else this.setData({ showImportDialog: false })
        }
      })
    } else {
      doImport(decoded)
    }
  },

  /** 导出标记 */
  exportMarkers() {
    if (this.data.markers.length === 0) {
      wx.showToast({ title: '暂无标记可导出', icon: 'none' })
      return
    }
    const code = this._encodeMarkers(this.data.markers)
    wx.setClipboardData({
      data: code,
      success: () => {
        wx.showToast({ title: `已复制 ${this.data.markers.length} 个标记代码` })
      }
    })
  },

  /** 导航到目标坐标 */
  navigateToTarget(lng, lat) {
    const mapComp = this.selectComponent('#tileMap')
    if (mapComp && lng && lat) {
      mapComp.moveToGeo(lng, lat)
    }
  },

  /** 返回 */
  goBack() {
    wx.navigateBack()
  },

  /** 微信分享 */
  onShareAppMessage() {
    const { markers, selectedMarker } = this.data
    if (markers.length > 0) {
      // 编码所有标记：lng,lat,encodedName 用 | 分隔
      const encoded = markers.map(m =>
        `${m.lng},${m.lat},${encodeURIComponent(m.name || '')}`
      ).join('|')
      const count = markers.length
      const label = selectedMarker && selectedMarker.name
        ? `：${selectedMarker.name}`
        : ''
      return {
        title: `我给你分享了${count}个SCUM地图位置${label}`,
        path: `/packageMap/pages/map/map?markers=${encoded}`
      }
    }
    return {
      title: '来看看SCUM地图',
      path: '/packageMap/pages/map/map'
    }
  }
})
