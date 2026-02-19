# 热点城市二手房价格仪表盘（静态网页）

这是一个无需构建工具的本地网页项目，用于查看多个城市二手房价格指数走势，并支持：
- 多城市同图对比（可多选/全选/清空）
- 以所选起点为 `100` 的定基展示（可选择展示区间）
- 累计跌幅与“跌回”分析
- 图内表格汇总与 PNG 导出（标准/超清）

---

## 1. 项目结构说明

```text
house-price-dashboard/
├── index.html                         # 页面结构
├── style.css                          # 页面样式
├── app.js                             # 图表渲染与交互逻辑
├── house-price-data.js                # 前端直接读取的数据源
├── house-price-data.json              # 与 JS 同步的数据快照（便于检查）
├── hk-centaline-monthly.json          # 香港 CCL 月度数据缓存
└── scripts/
    ├── extract-house-price-data.mjs   # 从 Excel 提取数据并生成前端数据文件
    └── fetch-hk-centaline-monthly.mjs # 从中原官网抓取周度数据并转月度
```

---

## 2. 如何打开网页

### 方案 A：线上使用（推荐）
本项目是纯静态网页，可直接部署到任意静态托管平台，部署后所有人都能通过同一个网页链接访问。

常见平台：
- GitHub Pages
- Netlify
- Vercel

部署目录：`house-price-dashboard/`（确保包含 `index.html`、`app.js`、`style.css`、`house-price-data.js`）。

### 方案 B：本地部署（通用）
```bash
cd "<项目根目录>/house-price-dashboard"
python3 -m http.server 8080
```
然后打开：

`http://127.0.0.1:8080`

---

## 3. 数据更新流程（推荐顺序）

### 第一步：抓取香港中原 CCL 并转为月度
```bash
cd "<项目根目录>"
node house-price-dashboard/scripts/fetch-hk-centaline-monthly.mjs
```

默认行为：
- 数据源页面：`https://hk.centanet.com/CCI/zh-cn/index`
- 从周度数据取“每月最后一周值”
- 输出区间：`2005-01` 到 `2026-01`
- 生成文件：`house-price-dashboard/hk-centaline-monthly.json`

### 第二步：提取 Excel 并合并香港数据
```bash
cd "<项目根目录>"
node house-price-dashboard/scripts/extract-house-price-data.mjs "<你的Excel路径.xlsx>"
```

默认行为：
- 如果不传 Excel 路径，脚本会尝试读取开发者机器上的默认路径（通常不适用于其他人）
- 自动合并上一步生成的香港月度数据
- 生成/更新：
  - `house-price-dashboard/house-price-data.js`
  - `house-price-dashboard/house-price-data.json`

---

## 4. 常用命令（带参数）

### 4.1 指定 Excel 路径
```bash
cd "<项目根目录>"
node house-price-dashboard/scripts/extract-house-price-data.mjs "/你的Excel路径.xlsx"
```

### 4.2 抓取脚本完整参数
```bash
node house-price-dashboard/scripts/fetch-hk-centaline-monthly.mjs \
  "https://hk.centanet.com/CCI/zh-cn/index" \
  "house-price-dashboard/hk-centaline-monthly.json" \
  "2005-01" \
  "2026-01"
```

参数顺序：
1) 来源 URL  
2) 输出 JSON 路径  
3) 起始月份（YYYY-MM）  
4) 结束月份（YYYY-MM）

---

## 5. 页面使用说明

1. 左侧勾选城市（支持全选/清空）。  
2. 选择起点与终点月份。  
3. 点击“**一键生成**”绘图。  
4. 需要时开启“累计跌幅”与“表格汇总”。  
5. 右上角工具箱可导出图片（标准/超清）。  

补充：
- 点击图例或曲线可隐藏/显示某城市。
- 当所选区间超出有效数据范围时，系统会自动调整区间并在状态栏提示。

---

## 6. 数据口径与规则

- 默认输出月份从 `2008-01` 开始（脚本内 `OUTPUT_MIN_MONTH` 限制）。  
- 香港数据来自中原官网 CCL 周度序列，按“月末最后一周”转月度。  
- 输出数据当前统一为 `2008-01 = 100`，页面会再按用户所选起点统一重定基为 `100`。  
- 当前脚本默认排除 `成都`（因该城市缺少 `2008-01` 基准点）。  

---

## 7. 数据授权与使用限制（请务必阅读）

- 本项目中的中原领先指数（非香港部分）来源于 Wind 付费数据。  
- 使用者需自行合法获取并按月更新数据（即每个月“投喂”最新 Excel 数据后再重新生成）。  
- 你必须确保自己拥有对应数据的使用授权；如无授权，请勿导入、传播或分享数据文件。  
- 本项目及其数据仅供学习与研究参考，不得用于任何商业用途。  

---

## 8. 常见问题（FAQ）

### Q1：页面空白或加载不完整怎么办？
- 先刷新页面；
- 再优先改用本地服务方式打开（`http://127.0.0.1:8080`）；
- 确认网络可访问 ECharts CDN。

### Q2：更新数据后图表没变化？
- 检查 `house-price-data.js` 更新时间是否已变化；
- 确认命令在项目根目录执行；
- 浏览器强制刷新（macOS: `Cmd + Shift + R`）。

### Q3：脚本报错 `unzip` 不存在？
- 本项目提取 Excel 依赖系统 `unzip` 命令，请先安装或启用该工具后重试。
