# 数据可视化

一个无需构建工具的前端项目，用于展示中国城市二手住宅价格指数走势，支持双数据源切换、跨源对比、区间重定基、累计跌幅分析与图片导出。

---

## 1. 当前能力总览

- 双数据源：
  - 中原领先指数（6城）
  - 国家统计局（二手住宅70城）
- 城市多选：一次最多选择 6 个城市。
- 跨源对比：仅在“单选且城市属于北上广深天津”时可开启。
- 定基规则：以用户当前可视区间的起点作为统一 `100`（滑块变化会实时重算）。
- 累计跌幅分析：
  - 图中标注“最高点 / 累计跌幅 / 跌回”
  - 跌回时间按全局规则：优先历史最早同值（按 1 位小数），否则取首次跨越该水平的更早月。
- 图内表格汇总（默认开启）与累计跌幅开关（默认关闭）。
- 导出 PNG（标准 / 超清），导出图自动排除滑块轨道。
- 图内滚轮不会缩放时间区间，会转为页面上下滚动。

---

## 2. 目录结构

```text
house-price-dashboard/
├── index.html
├── style.css
├── app.js
├── house-price-data.js
├── house-price-data.json
├── house-price-data-nbs-70.js
├── house-price-data-nbs-70.json
├── hk-centaline-monthly.json
└── scripts/
    ├── extract-house-price-data.mjs
    ├── fetch-hk-centaline-monthly.mjs
    └── fetch-nbs-70city-secondhand.mjs
```

---

## 3. 本地运行

```bash
cd "<项目根目录>/house-price-dashboard"
python3 -m http.server 8080
```

打开：

`http://127.0.0.1:8080`

---

## 4. 页面使用说明

1. 选择数据源（中原 6 城 / 统计局 70 城）。
2. 选择城市（最多 6 个）。
3. 选择时间区间。
4. 如满足条件，可开启“跨源对比”。
5. 点击“一键生成”。
6. 按需开启：
   - 累计跌幅
   - 表格汇总
7. 右上角可导出图片（标准 / 超清）。

补充：
- 图下透明滑块可直接缩放时间窗口。
- 拖动滑块时，曲线、定基和表格数据会同步更新。
- 可点击图例或曲线隐藏/恢复单个城市。

---

## 5. 双源对比规则

- 开启条件：
  - 仅选中 1 个城市；
  - 该城市属于：北京、上海、广州、深圳、天津；
  - 对比源不为“无”且不与当前源相同。
- 呈现方式：
  - 主源曲线为实线，对比源曲线为虚线；
  - 两条曲线均参与累计跌幅分析；
  - 图内表格首列标题在双源场景下为“房价数据源”；
  - 双源时表格列宽会自动右扩，避免靠近纵轴。

---

## 6. 数据口径与分析规则

- 页面默认输出区间：`2008-01` 到 `2026-01`（受数据可用性限制）。
- 前端展示统一按“当前可视起点 = 100”重定基。
- 香港数据：
  - 来源中原 CCL 周度序列；
  - 规则为“每月最后一周值转月度”。
- 统计局数据：
  - 来自国家统计局 70 城二手住宅销售价格指数（上月=100）；
  - 本地链式转换后用于前端展示。
- 跌回逻辑（全局）：
  - 在“最新点之前的历史区间”中寻找；
  - 优先最早同值（按 1 位小数）；
  - 无同值则取首次跨越该水平时的更早月份；
  - 再无则取最接近的历史点兜底。

---

## 7. 颜色策略

- 以下 6 城保留固定历史颜色：
  - 北京 `#5b9bd5`
  - 上海 `#e2843f`
  - 深圳 `#5d8f47`
  - 广州 `#e6b311`
  - 香港 `#1d1d1d`
  - 天津 `#7d8b99`
- 其他城市采用高区分度调色池，并做城市级缓存，保证同一城市跨次生成颜色稳定，且尽量避免与上述 6 城近似。

---

## 8. 数据更新流程

建议顺序：先更新香港，再更新中原主数据，再更新统计局 70 城数据。

### 8.1 更新香港 CCL（月度）

```bash
cd "<项目根目录>"
node house-price-dashboard/scripts/fetch-hk-centaline-monthly.mjs
```

输出：
- `house-price-dashboard/hk-centaline-monthly.json`

### 8.2 更新中原主数据（Excel + 香港合并）

```bash
cd "<项目根目录>"
node house-price-dashboard/scripts/extract-house-price-data.mjs "<你的Excel路径.xlsx>"
```

输出：
- `house-price-dashboard/house-price-data.js`
- `house-price-dashboard/house-price-data.json`

### 8.3 更新统计局 70 城数据

```bash
cd "<项目根目录>/house-price-dashboard"
node scripts/fetch-nbs-70city-secondhand.mjs
```

输出：
- `house-price-dashboard/house-price-data-nbs-70.js`
- `house-price-dashboard/house-price-data-nbs-70.json`

---

## 9. 部署说明

本项目为纯静态网页，可直接部署到：

- GitHub Pages
- Netlify
- Vercel

部署时确保以下文件同目录可访问：
- `index.html`
- `style.css`
- `app.js`
- `house-price-data.js`
- `house-price-data-nbs-70.js`

---

## 10. FAQ

### Q1: 页面一直显示“正在加载数据...”
- 检查是否通过 `http://` 本地服务打开（不要直接双击本地文件）。
- 检查 `house-price-data*.js` 是否存在且未损坏。

### Q2: 更新数据后图没变
- 确认脚本执行目录正确；
- 确认目标 `.js/.json` 的修改时间已更新；
- 浏览器强制刷新（macOS: `Cmd + Shift + R`）。

### Q3: 脚本报 `unzip` 缺失
- `extract-house-price-data.mjs` 依赖系统 `unzip`，请先安装后重试。

---

## 11. 合规与授权

- 中原相关原始数据可能涉及付费授权，请确保合法获取与使用。
- 项目和图表默认用于研究与交流，请按实际授权范围使用与传播。

---

## 12. 微信小程序版本（SwiftUI Charts 风格）

项目已新增小程序目录：`wechat-miniapp/`，复用现有房价数据并提供移动端可视化体验。

主要能力：
- 双数据源（中原 6 城 / 统计局 70 城）；
- 城市多选（最多 6 个）与搜索；
- 指数走势 / 累计回撤切换；
- 月度起止自定义区间（自动重定基）；
- 原生 Canvas 绘制的平滑曲线、渐变面积、触摸浮窗；
- 卡片指标 + 对比表，适配手机竖屏查看；
- 小程序内海报导出（预览 + 保存到相册）。

数据同步命令：

```bash
cd "<项目根目录>/house-price-dashboard"
node wechat-miniapp/scripts/sync-data.mjs
```

微信开发者工具导入目录：

`<项目根目录>/house-price-dashboard/wechat-miniapp`
