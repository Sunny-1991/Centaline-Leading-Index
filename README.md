# 房价可视化（静态网页项目）

一个无需构建工具的前端可视化项目，用于展示中国城市二手住宅价格指数走势。  
支持双数据源、跨源对比、区间重定基、累计跌幅分析、图内表格汇总与高分辨率图片导出。

---

## 1. 项目定位

- 面向研究与内容创作场景，快速生成可发布的房价趋势图。
- 保持纯静态部署（HTML/CSS/JS + 本地数据文件），部署与迁移成本低。
- 交互逻辑聚焦“区间可比性”：任何时段都可按统一起点 `100` 重算。

---

## 2. 核心功能

### 2.1 双数据源

- `中原领先指数（6城）`
- `国家统计局（二手住宅70城）`

### 2.2 城市与区间

- 城市最多可选 `6` 个。
- 统计局 70 城模式下，城市列表三列展示，便于快速定位。
- 通过起止时间 + 下方滑块联合选择分析窗口。

### 2.3 跨源对比

- 仅在 **单选城市** 且城市属于 `北京/上海/广州/深圳/天津` 时可启用。
- 主源实线、对比源虚线；两条线都参与累计跌幅分析。

### 2.4 累计跌幅分析

- 可在图上展示：`最高点` / `累计跌幅` / `跌回`。
- 跌回时间按“历史首次达到最新价水平”逻辑查找（含跨越兜底）。
- 具备标注避让策略，尽量减少文字重叠。

### 2.5 图表汇总与导出

- 图内表格汇总可开关（默认开启）。
- 累计跌幅分析可开关（默认关闭，需满足触发条件）。
- 支持 `标准` 与 `超清` PNG 导出，导出图自动排除工具按钮与滑块轨道。

### 2.6 主题与交互细节

- 支持浅色 / 深色主题切换。
- 图内滚轮不触发时间缩放，转为页面上下滚动。
- 保留核心城市（北上广深津港）固定颜色，其他城市自动分配高区分度颜色。

---

## 3. 目录结构

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
├── scripts/
│   ├── extract-house-price-data.mjs
│   ├── fetch-hk-centaline-monthly.mjs
│   └── fetch-nbs-70city-secondhand.mjs
├── docs/        # 本地文档（可选）
└── exports/     # 本地导出（可选）
```

---

## 4. 本地运行

```bash
cd "/Users/coattail/Documents/New project/house-price-dashboard"
python3 -m http.server 8080
```

浏览器打开：

`http://127.0.0.1:8080`

---

## 5. 页面使用流程

1. 选择数据源（中原 6 城 / 统计局 70 城）。
2. 选择城市（最多 6 个）。
3. 设定起止时间。
4. 需要时开启跨源对比（满足单城白名单条件）。
5. 点击“**一键生成**”。
6. 按需开启“累计跌幅 / 表格汇总”。
7. 通过右上角按钮导出图片（标准/超清）。

---

## 6. 数据与计算规则

### 6.1 统一定基

- 以当前可视区间起点为 `100`。
- 滑块移动后，曲线、表格和分析标注同步重算。

### 6.2 区间有效性

- 自动裁剪到所选城市共同有效区间。
- 当城市在起点月无有效值时，无法纳入本次绘图。

### 6.3 累计跌幅触发条件

- 仅当最新值较历史峰值回撤超过 `10%` 时可启用分析。

### 6.4 跌回时间查找（简述）

- 在“最新点之前的历史区间”中搜索。
- 优先找最早同值点（带容差）。
- 若不存在同值，找首次跨越该水平的更早点。
- 仍无结果时，回退为最接近值点。

---

## 7. 数据更新流程

建议顺序：**香港月度 -> 中原主数据 -> 统计局 70 城**。

### 7.1 拉取香港 CCL 周转月（取每月最后一周）

```bash
cd "/Users/coattail/Documents/New project/house-price-dashboard"
node scripts/fetch-hk-centaline-monthly.mjs
```

输出：`hk-centaline-monthly.json`

### 7.2 从 Excel 生成中原主数据并合并香港

```bash
cd "/Users/coattail/Documents/New project"
node house-price-dashboard/scripts/extract-house-price-data.mjs "/你的Excel路径.xlsx"
```

输出：

- `house-price-dashboard/house-price-data.js`
- `house-price-dashboard/house-price-data.json`

说明：

- 脚本默认按 `2008-01` 输出统一可视区间。
- 为保持统一定基口径，当前提取脚本已排除成都（`EXCLUDED_CITY_NAMES`）。

### 7.3 拉取并链式构建统计局 70 城数据

```bash
cd "/Users/coattail/Documents/New project/house-price-dashboard"
node scripts/fetch-nbs-70city-secondhand.mjs
```

输出：

- `house-price-data-nbs-70.js`
- `house-price-data-nbs-70.json`

说明：

- 脚本会将“上月=100”的月环比序列链式转换为可用于前端比较的指数序列。
- 为保持 70 城样本，当前脚本会排除拉萨（见脚本常量）。

---

## 8. 部署到 GitHub Pages

本项目是纯静态站点，直接推送到仓库 `main` 分支即可。

部署前确保以下文件在站点根目录可访问：

- `index.html`
- `style.css`
- `app.js`
- `house-price-data.js`
- `house-price-data-nbs-70.js`

---

## 9. 常见问题（FAQ）

### Q1. 页面一直显示“正在加载数据...”

- 请通过 `http://` 方式打开（不要双击本地文件）。
- 检查 `house-price-data*.js` 是否存在且内容完整。

### Q2. 修改后看不到变化

- 先 `Cmd + Shift + R` 强制刷新。
- 再确认 `index.html` 引用的 `?v=` 版本号是否已更新。

### Q3. 导出图片和网页显示不一致

- 先“一键生成”后再导出。
- 导出依赖当前图面状态（含城市筛选、区间、分析开关）。

### Q4. Excel 提取脚本报错缺少 unzip

- `extract-house-price-data.mjs` 依赖系统 `unzip`，请先安装后重试。

---

## 10. 合规说明

- 中原相关原始数据可能涉及授权，请在合法范围内获取与使用。
- 本项目默认用于研究、分析与交流场景；对外发布请遵循数据源与平台规则。
