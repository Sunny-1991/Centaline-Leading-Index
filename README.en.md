# House Price Dashboard (Centaline-Leading-Index)

[中文说明](./README.md)

A build-free static web dashboard for visualizing second-hand housing price indices across Chinese cities, with comparison tools, in-chart summary overlays, and high-resolution export.  
The monthly NBS auto-update runs in GitHub Actions and commits refreshed data files to the repo; the frontend runtime remains fully static.

## 1. Overview

- Designed for research, storytelling, and trend monitoring.
- Pure static architecture: `HTML + CSS + JavaScript + local data files`.
- Supports dual data sources, cross-source comparison, rebasing, drawdown analysis, and in-chart summary tables.
- Recently optimized for mobile portrait screens (layout, chart annotations, table density).

## 2. Key Features

### 2.1 Data Sources

- Centaline Leading Index (6 cities)
- NBS 70-city second-hand housing index (chain-linked rebasing)

### 2.2 Analytics & Visualization

- Rebase-on-range: current visible start month is set to `100`
- Drawdown analytics: `Peak / Drawdown / Recovery`
- Cross-source comparison: available when one supported city is selected
- In-chart summary table: toggle on/off
- PNG export: standard and ultra-HD; export excludes toolbox and slider track

### 2.3 UI & Interaction

- Light / dark themes
- City list with 3-column mode under NBS source
- Mobile-first adjustments for chart labels and table readability

## 3. Tech Stack

- Frontend: vanilla HTML / CSS / JavaScript
- Charting: ECharts (CDN)
- Snapshot export: html2canvas (CDN)
- Data scripts: Node.js (`scripts/*.mjs`)

## 4. Run Locally

```bash
cd "/path/to/Centaline-Leading-Index"
python3 -m http.server 9013
```

Then open:

- <http://127.0.0.1:9013>

> Do not open `index.html` directly via `file://`.

## 5. Typical Workflow

1. Choose a data source
2. Select cities (up to 6)
3. Choose date range
4. Optionally enable cross-source comparison
5. Click "Generate"
6. Toggle drawdown/table overlay as needed
7. Export image from chart toolbox (top right)

## 6. Data Rules

### 6.1 Rebase

- The visible range start month is rebased to `100`
- Any slider update recalculates lines and summaries

### 6.2 Valid Range

- Effective range is auto-clipped to shared valid months
- Cities without a valid value at the start month are excluded from that render

### 6.3 Drawdown Availability

- Enabled when latest value is more than `10%` below its historical peak

### 6.4 Recovery Date (short)

- Prefer earliest same-level historical point
- Fall back to crossing/nearest point if exact match is unavailable

## 7. Data Update Scripts

Recommended order: **Hong Kong monthly -> Centaline main data -> NBS 70-city**.

### 7.1 Fetch Hong Kong CCL monthly series

```bash
cd "/path/to/Centaline-Leading-Index"
node scripts/fetch-hk-centaline-monthly.mjs
```

Output: `hk-centaline-monthly.json`

### 7.2 Extract Centaline data from Excel and merge Hong Kong

```bash
cd "/path/to/Centaline-Leading-Index"
node scripts/extract-house-price-data.mjs "/path/to/your.xlsx"
```

Outputs:

- `house-price-data.js`
- `house-price-data.json`

### 7.3 Fetch and build NBS 70-city chain-linked series

```bash
cd "/path/to/Centaline-Leading-Index"
node scripts/fetch-nbs-70city-secondhand.mjs
```

Outputs:

- `house-price-data-nbs-70.js`
- `house-price-data-nbs-70.json`

### 7.4 Dependencies

- `extract-house-price-data.mjs` requires system `unzip`
- Fetch scripts require working network access (`curl` / `fetch`)
- Node.js 18+ recommended

## 8. Automatic Monthly NBS Updates

The repository includes a built-in GitHub Actions workflow for monthly NBS updates:

- Workflow file: `.github/workflows/auto-update-nbs-data.yml`
- Triggers:
  - Monthly scheduled run (UTC)
  - Manual run from GitHub Actions (`workflow_dispatch`)
- Behavior:
  - Runs `node scripts/fetch-nbs-70city-secondhand.mjs`
  - Commits and pushes only when `house-price-data-nbs-70.js` or `house-price-data-nbs-70.json` actually changes

The script now auto-truncates the timeline to the latest month available from the NBS API (no hard-coded end month).
This automation is only for NBS data; paid Centaline data should continue to be updated manually.
This does not turn the app into a dynamic backend service; pages still read static JS/JSON files from the repository.

Optional environment variables (advanced usage):

- `NBS_OUTPUT_MIN_MONTH` (default: `2008-01`)
- `NBS_OUTPUT_BASE_MONTH` (default: `2008-01`)
- `NBS_OUTPUT_MAX_MONTH` (default: current UTC month; final output uses the earlier one between this value and API latest month)

## 9. Project Structure

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
└── README.en.md
```

## 10. Deploy to GitHub Pages

This is a static site. Push to `main` branch and ensure these files are accessible at repo root:

- `index.html`
- `style.css`
- `app.js`
- `house-price-data.js`
- `house-price-data-nbs-70.js`

## 11. FAQ

### Q1. Page keeps showing "Loading..."

- Serve over `http://`, not `file://`
- Check `house-price-data*.js` files exist and are valid

### Q2. Changes do not appear

- Hard refresh (`Cmd/Ctrl + Shift + R`)
- Update asset version query strings in `index.html`

### Q3. Export image differs from screen

- Click "Generate" before export
- Export follows current chart state (range, selected cities, toggles)

## 12. Compliance Note

- Data sources may be subject to authorization constraints.
- Use within legal scope and comply with source/platform policies when publishing.
