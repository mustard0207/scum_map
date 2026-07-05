---
name: scum_scraper
description: SCUM-DB 数据抓取与清洗技能，包含如何使用Playwright处理动态懒加载的兼容性矩阵，以及如何解析结构化武器数据。
---

# SCUM-DB 武器数据抓取与清洗指南 (SCUM Scraper Skill)

本指南记录了从 `scum-db.com` 抓取并结构化处理 SCUM 武器及配件数据的标准流程和核心代码原理。由于该网站采用了 React/Next.js 框架并启用了特定组件的“懒加载（Lazy Loading）”，普通的静态 HTML 请求或无滚动的无头浏览器将丢失大量核心信息（如配件兼容性表）。

## 1. 核心流程与运行脚本

整个抓取与清洗过程被分解为三个主要步骤，对应的脚本存放在工作区根目录下：

### 第一步：获取所有目标链接
- **脚本**：`get_all_links.py` (及后续增补的 `fetch_missing.py`)
- **机制**：提取列表页（如 `/weapons/ranged`）下的所有带有 `group/item-card` 类的 `<a>` 标签 `href` 属性。
- **避坑**：注意不要仅使用 `Weapon_` 前缀过滤，因为弓箭（`Compound_Bow`）、爆炸物等物品的命名规则不包含该前缀，总计应当有 63 项武器。

### 第二步：自动化页面抓取与懒加载破解 (关键！)
- **脚本**：`scrape_details.py`
- **依赖**：`playwright` (`pip install playwright` 然后 `playwright install chromium`)
- **核心逻辑与避坑**：
  武器页面底部的 **COMPATIBILITY MATRIX（兼容性矩阵）** 不会在初次加载时立刻请求，必须通过模拟用户滚动到底部来触发页面内联的懒加载钩子（Intersection Observer）。
  ```python
  # 必须包含的懒加载触发逻辑
  page.goto(url, wait_until="domcontentloaded", timeout=30000)
  page.wait_for_selector("h1", timeout=15000)
  
  # 滚动到底部触发加载
  page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
  time.sleep(1.5) # 等待网络请求返回和 DOM 渲染
  page.evaluate("window.scrollTo(0, 0)")
  time.sleep(1)
  
  content = page.content()
  ```

### 第三步：数据提取与结构化清洗
- **脚本**：`clean_data.py`
- **依赖**：`beautifulsoup4`
- **提取逻辑**：
  - **基础属性**：查找所有带有 `tactical-stat` 类的元素，向其父级提取 "Key | Value" 形式的数据（例如 Damage, Weight, Muzzle velocity 等）。
  - **配件兼容矩阵**：定位包含 `COMPATIBILITY MATRIX` 的 `h2` 标签。向下遍历其兄弟/子级元素，识别分类的 `h3`/`h4` 标题（如 `MAGAZINES`, `SCOPE`, `SUPPRESSOR`）。随后将属于该分类下的所有子级链接元素（`<a>`）提取并去重。
- **输出格式**：将结构化的词典保存为 JSON (`scum_weapons_data_final.json`)，并将数组内的数据用逗号 `', '` 拼接后导出为兼容表格软件的 CSV 格式 (`scum_weapons_data_final.csv`)。

## 2. 数据结构规范

产出的 JSON 文件包含以下基础层级（以 AK-15 为例）：
```json
{
  "Name": "AK-15",
  "Damage": "97.50",
  "Caliber": "762x39mm",
  "Magazines": ["AK15 Magazine"],
  "Ammunition": ["7.62x39mm Ammo", "7.62x39mm AP Ammo"],
  "Sights": ["Red Dot Sight", "OKP Holographic Sight"],
  "Scopes": ["ACOG", "M82 Scope"],
  "Suppressors": ["AK15 Suppressor"],
  "Flashlights": ["Improvised Flashlight"],
  "Bayonets": [],
  "Rails": [],
  "Other": ["Weapon Ghillie"]
}
```

## 3. 注意事项
1. **防止文件锁定报错**：在运行清洗脚本重新写入 CSV 时，确保之前生成的 CSV 文件没有被 Excel 或 WPS 等软件打开占用，否则会报 `PermissionError: [Errno 13]`。
2. **特殊武器数据**：由于游戏机制设定，简易火焰喷射器（Improvised Flamethrower）等非弹道类武器可能会缺失 `Damage` 或常规 `Ammunition` 字段，且众多枪械和重武器本身不具备弹匣（如栓动步枪、左轮等），其 `Magazines` 字段为空数组属于正常情况。
