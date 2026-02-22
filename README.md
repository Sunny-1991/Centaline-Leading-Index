# 房价可视化（Centaline-Leading-Index）

[English README](./README.en.md)

一个无需构建工具（build-free）的静态网页项目，用于展示中国城市二手住宅价格指数走势，支持对比分析、图内统计表与高清导出。  
统计局数据的“自动月更”由 GitHub Actions 在仓库侧预生成并提交数据文件，前端运行时仍是纯静态资源加载。

## 1. 项目概览

- 适用于研究、内容创作、趋势观察等场景。
- 保持纯前端静态结构：`HTML + CSS + JavaScript + 本地数据文件`。
- 支持双数据源、跨源对比、区间重定基、累计跌幅分析、图内表格汇总。
- 近期已针对手机竖屏场景做了布局与字号自适应优化。

## 2. 核心功能

### 2.1 数据源

- 中原领先指数（6城）
- 国家统计局（二手住宅70城，链式定基）

### 2.2 分析与可视化

- 区间重定基：当前可视区间起点自动作为 `100`
- 累计跌幅分析：显示 `最高点 / 累计跌幅 / 跌回`
- 跨源对比：单选城市且在白名单城市时可启用
- 图内统计汇总表：支持显示/隐藏
- 高清导出：标准与超清 PNG（导出时自动排除工具按钮与滑块轨道）

### 2.3 交互与样式

- 浅色 / 深色主题切换
- 城市列表（统计局数据源下支持三列模式）
- 手机端自适应（图表尺寸、标注字号、表格密度等）

## 3. 技术栈

- 前端：原生 HTML / CSS / JavaScript
- 图表：ECharts（CDN）
- 截图导出：html2canvas（CDN）
- 数据脚本：Node.js（`scripts/*.mjs`）

## 4. 本地运行

```bash
cd "/path/to/Centaline-Leading-Index"
python3 -m http.server 9013
```

浏览器打开：

- <http://127.0.0.1:9013>

> 不要直接双击 `index.html` 打开（会触发本地文件跨域/资源加载问题）。

## 5. 页面使用流程

1. 选择数据源
2. 选择城市（最多 6 个）
3. 选择起止时间
4. 需要时开启跨源对比
5. 点击“一键生成”
6. 按需开启/关闭“累计跌幅”“表格汇总”
7. 使用右上角工具按钮导出图像

## 6. 数据口径与规则

### 6.1 定基规则

- 当前滑块区间起点作为 `100`
- 滑块变化后，曲线与统计同步重算

### 6.2 区间有效性

- 自动裁剪到所选城市共同有效区间
- 若某城市在起点月无有效值，则不会纳入当次绘图

### 6.3 累计跌幅触发条件

- 当最新值较历史峰值回撤超过 `10%` 时可启用

### 6.4 跌回时间（简述）

- 优先寻找历史同值点
- 不存在同值时使用跨越点/最近点兜底

## 7. 数据更新脚本

建议顺序：**香港月度 -> 中原主数据 -> 统计局70城**。

### 7.1 拉取香港 CCL 月度（按月末周值）

```bash
cd "/path/to/Centaline-Leading-Index"
node scripts/fetch-hk-centaline-monthly.mjs
```

输出：`hk-centaline-monthly.json`

### 7.2 从 Excel 提取中原主数据并合并香港

```bash
cd "/path/to/Centaline-Leading-Index"
node scripts/extract-house-price-data.mjs "/你的Excel路径.xlsx"
```

输出：

- `house-price-data.js`
- `house-price-data.json`

### 7.3 拉取并构建统计局 70 城链式序列

```bash
cd "/path/to/Centaline-Leading-Index"
node scripts/fetch-nbs-70city-secondhand.mjs
```

输出：

- `house-price-data-nbs-70.js`
- `house-price-data-nbs-70.json`

### 7.4 依赖说明

- `extract-house-price-data.mjs` 依赖系统命令 `unzip`
- 网络抓取脚本依赖可用网络（`curl` / `fetch`）
- 建议 Node.js 18+

## 8. 自动月更（统计局）

项目已内置 GitHub Actions 自动月更流程：

- 工作流文件：`.github/workflows/auto-update-nbs-data.yml`
- 触发方式：
  - 每月定时运行（UTC 时间）
  - GitHub Actions 页面手动触发（`workflow_dispatch`）
- 行为：
  - 执行 `node scripts/fetch-nbs-70city-secondhand.mjs`
  - 仅在 `house-price-data-nbs-70.js` / `house-price-data-nbs-70.json` 发生变化时自动提交并推送

脚本会根据统计局接口的最新可用月份自动截断时间轴，不再写死到某个固定月份。
该自动流程仅覆盖统计局数据；中原付费数据建议继续人工更新后再提交。
这不会把项目变成动态后端站点：页面仍直接读取仓库中的静态 JS/JSON 数据文件。

可选环境变量（高级用法）：

- `NBS_OUTPUT_MIN_MONTH`（默认 `2008-01`）
- `NBS_OUTPUT_BASE_MONTH`（默认 `2008-01`）
- `NBS_OUTPUT_MAX_MONTH`（默认当前 UTC 月，最终会与接口最新月份取较小值）

## 9. 目录结构

```text
Centaline-Leading-Index/
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
└── README.md
```

## 10. 发布到 GitHub Pages

本项目为纯静态站点，推送到 `main` 分支即可。

请确保以下文件位于站点根目录并可访问：

- `index.html`
- `style.css`
- `app.js`
- `house-price-data.js`
- `house-price-data-nbs-70.js`

## 11. 常见问题

### Q1. 页面一直停留在“正在加载数据...”

- 使用 `http://` 方式访问（不要用 `file://`）
- 检查 `house-price-data*.js` 文件是否存在且内容完整

### Q2. 改了代码但页面没变化

- 强制刷新（`Cmd/Ctrl + Shift + R`）
- 检查 `index.html` 里资源 `?v=` 参数是否已更新

### Q3. 导出图与页面不一致

- 先点击“一键生成”再导出
- 导出基于当前页面状态（区间、城市、分析开关）

## 12. 合规说明

- 数据源可能涉及授权与使用限制，请在合法范围内获取和使用。
- 本项目默认用于研究、分析与交流场景，对外发布请遵守数据源与平台规则。
