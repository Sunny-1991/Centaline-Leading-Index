let raw = null;
let activeSourceMeta = null;

const SOURCE_CONFIGS = [
  {
    key: "centaline6",
    label: "中原领先指数（6城）",
    legendLabel: "中原",
    sourceTitle: "中原领先指数（月度）",
    heroSubtitle: "数据来源：Wind、中原研究中心",
    defaultSelectedNames: null,
    data: window.HOUSE_PRICE_SOURCE_DATA,
  },
  {
    key: "nbs70",
    label: "国家统计局（二手住宅70城）",
    legendLabel: "统计局",
    sourceTitle: "国家统计局70城二手住宅销售价格指数（上月=100，链式定基）",
    heroSubtitle: "数据来源：国家统计局（70城二手住宅销售价格指数）",
    defaultSelectedNames: ["北京", "上海", "广州", "深圳", "天津", "重庆"],
    data: window.HOUSE_PRICE_SOURCE_DATA_NBS_70,
  },
];

const cityListEl = document.getElementById("cityList");
const startMonthEl = document.getElementById("startMonth");
const endMonthEl = document.getElementById("endMonth");
const dataSourceEl = document.getElementById("dataSource");
const compareSourceEl = document.getElementById("compareSource");
const compareHintEl = document.getElementById("compareHint");
const renderBtn = document.getElementById("renderBtn");
const selectAllBtn = document.getElementById("selectAllBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const drawdownBtn = document.getElementById("drawdownBtn");
const chartTableBtn = document.getElementById("chartTableBtn");
const statusEl = document.getElementById("statusText");
const summaryBodyEl = document.getElementById("summaryBody");
const chartTitleEl = document.getElementById("chartTitle");
const chartMetaEl = document.getElementById("chartMeta");
const footnoteEl = document.getElementById("footnoteText");
const chartStatsOverlayEl = document.getElementById("chartStatsOverlay");
const chartEl = document.getElementById("chart");
const sourceSubtitleEl = document.getElementById("sourceSubtitleText");

const chart = echarts.init(chartEl, null, {
  renderer: "canvas",
});

const fallbackPalette = ["#5b9bd5", "#e2843f", "#5d8f47", "#e6b311", "#7d8b99", "#1d1d1d"];
const namedColorMap = {
  北京: "#5b9bd5",
  上海: "#e2843f",
  深圳: "#5d8f47",
  广州: "#e6b311",
  香港: "#1d1d1d",
  天津: "#7d8b99",
};
const OVERLAY_CITY_ORDER = ["北京", "上海", "广州", "深圳", "天津", "香港"];
const OVERLAY_CITY_ORDER_INDEX = new Map(
  OVERLAY_CITY_ORDER.map((name, index) => [name, index]),
);
const CHART_FONT_FAMILY = '"STKaiti", "Kaiti SC", "KaiTi", "BiauKai", serif';
const CHART_LAYOUT_BASE_WIDTH = 1160;
const CHART_LAYOUT_ASPECT_RATIO = 0.78;
const CHART_LAYOUT_MIN_HEIGHT = 420;
const CHART_LAYOUT_MAX_HEIGHT = 1080;
const OVERLAY_LEFT_RATIO = 0.12;
const OVERLAY_TOP_RATIO = 0.05;
const OVERLAY_SCALE_MIN = 0.72;
const OVERLAY_SCALE_MAX = 1.3;
const OVERLAY_TABLE_SCALE = 1.05;
const CHART_TEXT_MASK_COLOR = "rgba(255, 255, 255, 0.56)";
const CHART_GRID_LAYOUT = Object.freeze({
  left: 70,
  right: 90,
  top: 44,
  bottom: 112,
});
const MAX_SELECTED_CITY_COUNT = 6;
const COMPARE_CITY_WHITELIST = new Set(["北京", "上海", "广州", "深圳", "天津"]);
const cityById = new Map();
const cityValidRanges = new Map();
const uiState = {
  showDrawdownAnalysis: false,
  showChartTable: true,
  hiddenCityNames: new Set(),
  zoomStartMonth: null,
  zoomEndMonth: null,
};
let isApplyingOption = false;
let latestRenderContext = null;
let dataZoomSyncTimer = null;
let isSyncingRangeFromSlider = false;
let textMeasureContext = null;
let resizeRenderTimer = null;

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function formatNumber(value, digits = 1) {
  if (!isFiniteNumber(value)) return "-";
  return Number(value).toFixed(digits);
}

function formatPercent(value, digits = 1) {
  if (!isFiniteNumber(value)) return "-";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

function formatMonthZh(month) {
  if (!/^\d{4}-\d{2}$/.test(String(month))) return String(month || "-");
  const [year, m] = String(month).split("-");
  return `${year}年${Number(m)}月`;
}

function setStatus(text, isError = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("error", isError);
}

function isUsableSourceData(data) {
  return Boolean(
    data &&
      Array.isArray(data.dates) &&
      data.dates.length > 0 &&
      Array.isArray(data.cities) &&
      data.cities.length > 0 &&
      data.values &&
      typeof data.values === "object",
  );
}

function listAvailableSources() {
  return SOURCE_CONFIGS.filter((source) => isUsableSourceData(source.data));
}

function findSourceByKey(sourceKey) {
  const available = listAvailableSources();
  const matched = available.find((source) => source.key === sourceKey);
  return matched || available[0] || null;
}

function populateSourceSelector(availableSources) {
  if (!dataSourceEl) return;
  dataSourceEl.innerHTML = availableSources
    .map((source) => `<option value="${source.key}">${source.label}</option>`)
    .join("");
  dataSourceEl.disabled = availableSources.length <= 1;
}

function buildCityMaps() {
  cityById.clear();
  cityValidRanges.clear();
  raw.cities.forEach((city) => {
    cityById.set(city.id, city);
    cityValidRanges.set(city.id, getSeriesValidRange(city.id, city.availableRange));
  });
}

function applyDataSource(sourceKey) {
  const source = findSourceByKey(sourceKey);
  if (!source) return false;

  raw = source.data;
  activeSourceMeta = source;
  if (sourceSubtitleEl) {
    sourceSubtitleEl.textContent = source.heroSubtitle;
  }
  if (dataSourceEl && dataSourceEl.value !== source.key) {
    dataSourceEl.value = source.key;
  }

  uiState.hiddenCityNames.clear();
  uiState.zoomStartMonth = null;
  uiState.zoomEndMonth = null;
  uiState.showDrawdownAnalysis = false;
  uiState.showChartTable = true;

  buildCityMaps();
  buildCityControls(raw.cities, source.defaultSelectedNames);
  buildMonthSelects(raw.dates);
  refreshCompareSourceControl({ keepSelection: false });
  return true;
}

function getAlternateSourcesForCompare() {
  return listAvailableSources().filter((source) => source.key !== activeSourceMeta?.key);
}

function getCompareEligibility(selectedCityIds = readSelectedCityIds()) {
  if (selectedCityIds.length !== 1) {
    return {
      eligible: false,
      cityName: null,
      reason: "仅在单选城市时可开启跨源对比",
    };
  }
  const selectedCity = cityById.get(selectedCityIds[0]);
  if (!selectedCity) {
    return {
      eligible: false,
      cityName: null,
      reason: "当前城市不存在",
    };
  }
  if (!COMPARE_CITY_WHITELIST.has(selectedCity.name)) {
    return {
      eligible: false,
      cityName: selectedCity.name,
      reason: "仅支持北上广深天津单城对比",
    };
  }
  return {
    eligible: true,
    cityName: selectedCity.name,
    reason: "",
  };
}

function refreshCompareSourceControl({ keepSelection = true } = {}) {
  if (!compareSourceEl) return;

  const previousValue = compareSourceEl.value || "none";
  const alternatives = getAlternateSourcesForCompare();
  const eligibility = getCompareEligibility();

  const options = ['<option value="none">不对比</option>']
    .concat(
      alternatives.map(
        (source) => `<option value="${source.key}">${source.label}</option>`,
      ),
    )
    .join("");
  compareSourceEl.innerHTML = options;

  const canEnable = eligibility.eligible && alternatives.length > 0;
  compareSourceEl.disabled = !canEnable;

  let nextValue = "none";
  if (canEnable && keepSelection && alternatives.some((source) => source.key === previousValue)) {
    nextValue = previousValue;
  }
  compareSourceEl.value = nextValue;

  if (compareHintEl) {
    if (!eligibility.eligible) {
      compareHintEl.textContent = eligibility.reason;
    } else if (!canEnable) {
      compareHintEl.textContent = "暂无可用于对比的其他数据源";
    } else if (nextValue === "none") {
      compareHintEl.textContent = `可对 ${eligibility.cityName} 开启跨源对比`;
    } else {
      const matched = alternatives.find((source) => source.key === nextValue);
      compareHintEl.textContent = `已开启 ${eligibility.cityName} 与${matched?.label || "另一数据源"}对比`;
    }
  }
}

function enforceCitySelectionLimit(lastChangedInput = null) {
  const checkedInputs = [...cityListEl.querySelectorAll('input[type="checkbox"]:checked')];
  if (checkedInputs.length <= MAX_SELECTED_CITY_COUNT) {
    return true;
  }

  if (lastChangedInput && lastChangedInput.checked) {
    lastChangedInput.checked = false;
  } else {
    checkedInputs.slice(MAX_SELECTED_CITY_COUNT).forEach((input) => {
      input.checked = false;
    });
  }
  return false;
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resolveAxisMonthFromZoomValue(value, percent, axisData) {
  if (!Array.isArray(axisData) || axisData.length === 0) return null;

  if (typeof value === "string" && axisData.includes(value)) {
    return value;
  }

  if (Number.isFinite(value)) {
    const index = Math.round(clampNumber(Number(value), 0, axisData.length - 1));
    return axisData[index] ?? null;
  }

  if (Number.isFinite(percent)) {
    const index = Math.round((clampNumber(Number(percent), 0, 100) / 100) * (axisData.length - 1));
    return axisData[index] ?? null;
  }

  return null;
}

function resolveResponsiveChartLayout(chartWidth) {
  if (chartWidth <= 520) {
    return {
      aspectRatio: 1.02,
      minHeight: 360,
      maxHeight: 680,
      overlayScaleMin: 0.4,
      overlayScaleMax: 0.8,
      overlayLeftRatio: 0.21,
      overlayTopRatio: 0.042,
    };
  }
  if (chartWidth <= 760) {
    return {
      aspectRatio: 0.94,
      minHeight: 390,
      maxHeight: 760,
      overlayScaleMin: 0.46,
      overlayScaleMax: 0.9,
      overlayLeftRatio: 0.18,
      overlayTopRatio: 0.046,
    };
  }
  if (chartWidth <= 1120) {
    return {
      aspectRatio: 0.74,
      minHeight: 420,
      maxHeight: 920,
      overlayScaleMin: 0.62,
      overlayScaleMax: 1.08,
      overlayLeftRatio: 0.14,
      overlayTopRatio: 0.05,
    };
  }
  return {
    aspectRatio: CHART_LAYOUT_ASPECT_RATIO,
    minHeight: CHART_LAYOUT_MIN_HEIGHT,
    maxHeight: CHART_LAYOUT_MAX_HEIGHT,
    overlayScaleMin: OVERLAY_SCALE_MIN,
    overlayScaleMax: OVERLAY_SCALE_MAX,
    overlayLeftRatio: OVERLAY_LEFT_RATIO,
    overlayTopRatio: OVERLAY_TOP_RATIO,
  };
}

function resolveXAxisLabelLayout(months, chartWidth, visibleStartIndex, visibleEndIndex) {
  const safeStart = clampNumber(
    Number.isInteger(visibleStartIndex) ? visibleStartIndex : 0,
    0,
    Math.max(0, months.length - 1),
  );
  const safeEnd = clampNumber(
    Number.isInteger(visibleEndIndex) ? visibleEndIndex : safeStart,
    safeStart,
    Math.max(0, months.length - 1),
  );

  let maxLabels = 18;
  let preferredMonths = new Set(["01", "07"]);
  let rotate = 42;
  let fontSize = 11.5;
  let margin = 14;

  if (chartWidth <= 520) {
    maxLabels = 6;
    preferredMonths = new Set(["01"]);
    rotate = 34;
    fontSize = 9.8;
    margin = 12;
  } else if (chartWidth <= 760) {
    maxLabels = 8;
    preferredMonths = new Set(["01"]);
    rotate = 38;
    fontSize = 10.4;
    margin = 13;
  } else if (chartWidth <= 1120) {
    maxLabels = 12;
    preferredMonths = new Set(["01"]);
  }

  const candidateIndexes = [];
  for (let index = safeStart; index <= safeEnd; index += 1) {
    const month = String(months[index] || "").slice(5, 7);
    if (preferredMonths.has(month)) {
      candidateIndexes.push(index);
    }
  }

  if (candidateIndexes.length === 0) {
    candidateIndexes.push(safeStart);
    if (safeEnd !== safeStart) {
      candidateIndexes.push(safeEnd);
    }
  }

  const stride = Math.max(1, Math.ceil(candidateIndexes.length / maxLabels));
  const visibleIndexes = new Set();
  candidateIndexes.forEach((index, order) => {
    if (order % stride === 0) {
      visibleIndexes.add(index);
    }
  });

  visibleIndexes.add(safeStart);
  visibleIndexes.add(safeEnd);
  const visibleValues = new Set();
  visibleIndexes.forEach((index) => {
    const value = months[index];
    if (typeof value === "string" && value) {
      visibleValues.add(value);
    }
  });

  return {
    margin,
    rotate,
    fontSize,
    isLabelVisible(value, index) {
      if (Number.isInteger(index) && visibleIndexes.has(index)) {
        return true;
      }
      return visibleValues.has(String(value || ""));
    },
  };
}

function syncChartViewport({ resizeChart = true } = {}) {
  const chartWidth = chartEl.clientWidth;
  if (!chartWidth) return;
  const layout = resolveResponsiveChartLayout(chartWidth);

  const chartHeight = Math.round(
    clampNumber(
      chartWidth * layout.aspectRatio,
      layout.minHeight,
      layout.maxHeight,
    ),
  );
  chartEl.style.height = `${chartHeight}px`;

  const overlayScale = clampNumber(
    chartWidth / CHART_LAYOUT_BASE_WIDTH,
    layout.overlayScaleMin,
    layout.overlayScaleMax,
  );
  const preferredLeft = Math.round(chartWidth * layout.overlayLeftRatio);
  const preferredTop = Math.round(chartHeight * layout.overlayTopRatio);
  chartStatsOverlayEl.style.transform = `scale(${overlayScale})`;

  const rawOverlayWidth = Number(chartStatsOverlayEl.offsetWidth) || 0;
  const rawOverlayHeight = Number(chartStatsOverlayEl.offsetHeight) || 0;
  const scaledOverlayWidth = rawOverlayWidth * overlayScale;
  const scaledOverlayHeight = rawOverlayHeight * overlayScale;

  const maxLeft = Math.max(8, chartWidth - scaledOverlayWidth - 8);
  const overlaySafeGap = chartWidth <= 520 ? 56 : chartWidth <= 760 ? 46 : 18;
  const requestedMinLeft = CHART_GRID_LAYOUT.left + overlaySafeGap;
  const minLeft = Math.min(requestedMinLeft, maxLeft);
  const finalLeft =
    scaledOverlayWidth > 0
      ? Math.round(clampNumber(preferredLeft, minLeft, maxLeft))
      : preferredLeft;

  const minTop = 8;
  const maxTop = Math.max(minTop, chartHeight - scaledOverlayHeight - 8);
  const finalTop =
    scaledOverlayHeight > 0
      ? Math.round(clampNumber(preferredTop, minTop, maxTop))
      : preferredTop;

  chartStatsOverlayEl.style.left = `${finalLeft}px`;
  chartStatsOverlayEl.style.top = `${finalTop}px`;

  if (resizeChart) {
    chart.resize();
  }
}

function bindChartWheelToPageScroll() {
  chartEl.addEventListener(
    "wheel",
    (event) => {
      const delta = Number(event.deltaY);
      if (!Number.isFinite(delta) || delta === 0) return;
      window.scrollBy({ top: delta, left: 0, behavior: "auto" });
      event.preventDefault();
      event.stopPropagation();
    },
    { passive: false, capture: true },
  );
}

function toggleCityVisibility(cityName) {
  if (!cityName) return;
  if (uiState.hiddenCityNames.has(cityName)) {
    uiState.hiddenCityNames.delete(cityName);
  } else {
    uiState.hiddenCityNames.add(cityName);
  }
}

function readSelectedCityIds() {
  return [...cityListEl.querySelectorAll('input[type="checkbox"]:checked')].map((el) => el.value);
}

function parseRangeText(text) {
  const match = String(text || "").match(/(\d{4}-\d{2}).*?(\d{4}-\d{2})/);
  if (!match) return null;
  return { start: match[1], end: match[2] };
}

function getSeriesValidRange(cityId, fallbackText = "") {
  const series = raw.values?.[cityId];
  if (Array.isArray(series) && series.length > 0) {
    let startIndex = -1;
    let endIndex = -1;
    for (let i = 0; i < series.length; i += 1) {
      if (isFiniteNumber(series[i])) {
        startIndex = i;
        break;
      }
    }
    for (let i = series.length - 1; i >= 0; i -= 1) {
      if (isFiniteNumber(series[i])) {
        endIndex = i;
        break;
      }
    }
    if (startIndex >= 0 && endIndex >= 0 && startIndex <= endIndex) {
      return {
        startIndex,
        endIndex,
        startMonth: raw.dates[startIndex],
        endMonth: raw.dates[endIndex],
      };
    }
  }

  const fallback = parseRangeText(fallbackText);
  if (!fallback) return null;
  const startIndex = raw.dates.indexOf(fallback.start);
  const endIndex = raw.dates.indexOf(fallback.end);
  if (startIndex < 0 || endIndex < 0 || startIndex > endIndex) return null;
  return {
    startIndex,
    endIndex,
    startMonth: fallback.start,
    endMonth: fallback.end,
  };
}

function getSelectedEffectiveRange(selectedCityIds) {
  let startIndex = -1;
  let endIndex = Number.POSITIVE_INFINITY;

  for (const cityId of selectedCityIds) {
    const range = cityValidRanges.get(cityId);
    if (!range) continue;
    startIndex = Math.max(startIndex, range.startIndex);
    endIndex = Math.min(endIndex, range.endIndex);
  }

  if (startIndex < 0 || !Number.isFinite(endIndex) || startIndex > endIndex) return null;
  return {
    startIndex,
    endIndex,
    startMonth: raw.dates[startIndex],
    endMonth: raw.dates[endIndex],
  };
}

function buildCityControls(cities, defaultSelectedNames = null) {
  cityListEl.innerHTML = "";
  const preferredNameSet =
    Array.isArray(defaultSelectedNames) && defaultSelectedNames.length > 0
      ? new Set(defaultSelectedNames)
      : null;
  const orderedCities = [...cities].sort((a, b) => {
    const aRank = OVERLAY_CITY_ORDER_INDEX.has(a.name)
      ? OVERLAY_CITY_ORDER_INDEX.get(a.name)
      : Number.MAX_SAFE_INTEGER;
    const bRank = OVERLAY_CITY_ORDER_INDEX.has(b.name)
      ? OVERLAY_CITY_ORDER_INDEX.get(b.name)
      : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return a.name.localeCompare(b.name, "zh-CN");
  });

  for (const city of orderedCities) {
    const label = document.createElement("label");
    label.className = "city-item";
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = city.id;
    input.checked = preferredNameSet ? preferredNameSet.has(city.name) : true;
    const text = document.createElement("span");
    text.textContent = city.name;
    label.append(input, text);
    cityListEl.appendChild(label);
  }
}

function buildMonthSelects(dates) {
  const options = dates
    .map((month) => `<option value="${month}">${month}</option>`)
    .join("");

  startMonthEl.innerHTML = options;
  endMonthEl.innerHTML = options;

  const defaultStart = dates.includes("2008-01") ? "2008-01" : dates[0];
  const defaultEnd = dates.includes("2026-01") ? "2026-01" : dates[dates.length - 1];
  startMonthEl.value = defaultStart;
  endMonthEl.value = defaultEnd;
}

function colorFromCityName(cityName = "", index = 0) {
  const text = String(cityName);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 131 + text.charCodeAt(i)) >>> 0;
  }
  const seed = (hash + index * 47) % 360;
  const hue = (seed * 11) % 360;
  return `hsl(${hue}, 56%, 42%)`;
}

function getColor(cityName, index) {
  if (namedColorMap[cityName]) return namedColorMap[cityName];
  if (index < fallbackPalette.length) return fallbackPalette[index];
  return colorFromCityName(cityName, index);
}

function getLastFiniteInfo(values, dates) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (isFiniteNumber(values[i])) {
      return { value: values[i], date: dates[i] };
    }
  }
  return { value: null, date: null };
}

function getLastFiniteIndex(values) {
  for (let i = values.length - 1; i >= 0; i -= 1) {
    if (isFiniteNumber(values[i])) return i;
  }
  return -1;
}

function alignSeriesByMonths(dataset, series, months) {
  const monthToValue = new Map();
  dataset.dates.forEach((month, index) => {
    monthToValue.set(month, series[index]);
  });
  return months.map((month) => {
    const value = monthToValue.get(month);
    return isFiniteNumber(value) ? value : null;
  });
}

function resolveCompareContext(selectedCityIds) {
  if (!compareSourceEl) return null;

  const compareSourceKey = compareSourceEl.value;
  if (!compareSourceKey || compareSourceKey === "none") return null;

  const eligibility = getCompareEligibility(selectedCityIds);
  if (!eligibility.eligible) return null;

  const compareSource = findSourceByKey(compareSourceKey);
  if (!compareSource || compareSource.key === activeSourceMeta?.key) return null;

  const compareCity = compareSource.data?.cities?.find((city) => city.name === eligibility.cityName);
  if (!compareCity) return null;

  return {
    cityName: eligibility.cityName,
    source: compareSource,
    city: compareCity,
  };
}

function calcPctChange(currentValue, baseValue) {
  if (!isFiniteNumber(currentValue) || !isFiniteNumber(baseValue) || baseValue === 0) return null;
  return ((currentValue / baseValue) - 1) * 100;
}

function findRecoverIndex(values, latestValue, peakIndex) {
  if (!Array.isArray(values) || !isFiniteNumber(latestValue)) return -1;
  if (!Number.isInteger(peakIndex) || peakIndex < 0) return -1;

  const safePeakIndex = Math.min(peakIndex, values.length - 1);
  const toleranceRatio = 0.03;
  let recoverIndex = -1;

  for (let i = 0; i <= safePeakIndex; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) continue;
    const ratioDiff = Math.abs(value - latestValue) / Math.max(Math.abs(latestValue), 1);
    if (ratioDiff <= toleranceRatio) {
      recoverIndex = i;
      break;
    }
  }

  if (recoverIndex < 0) {
    for (let i = 0; i <= safePeakIndex; i += 1) {
      const value = values[i];
      if (!isFiniteNumber(value)) continue;
      if (value >= latestValue) {
        recoverIndex = i;
        break;
      }
    }
  }

  if (recoverIndex < 0) {
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let i = 0; i <= safePeakIndex; i += 1) {
      const value = values[i];
      if (!isFiniteNumber(value)) continue;
      const diff = Math.abs(value - latestValue);
      if (diff < bestDiff) {
        bestDiff = diff;
        recoverIndex = i;
      }
    }
  }

  return recoverIndex;
}

function decorateDrawdownForViewport(
  drawdown,
  normalizedAll,
  monthsAll,
  viewportStartOffset,
  viewportEndOffset,
) {
  if (!drawdown) return null;

  const toGlobalIndex = (localIndex) => localIndex + viewportStartOffset;
  const peakGlobalIndex = toGlobalIndex(drawdown.peakIndex);
  const latestGlobalIndex = toGlobalIndex(drawdown.latestIndex);

  let recoverGlobalIndex = findRecoverIndex(normalizedAll, drawdown.latestValue, peakGlobalIndex);
  if (!Number.isInteger(recoverGlobalIndex) || recoverGlobalIndex < 0) {
    recoverGlobalIndex = toGlobalIndex(drawdown.recoverIndex);
  }

  const visibleStart = clampNumber(viewportStartOffset, 0, monthsAll.length - 1);
  const visibleEnd = clampNumber(viewportEndOffset, visibleStart, monthsAll.length - 1);
  const latestVisibleIndex = clampNumber(latestGlobalIndex, visibleStart, visibleEnd);
  const recoverDisplayIndex = clampNumber(recoverGlobalIndex, visibleStart, latestVisibleIndex);

  const recoverMonth =
    recoverGlobalIndex >= 0 && recoverGlobalIndex < monthsAll.length
      ? monthsAll[recoverGlobalIndex]
      : drawdown.recoverMonth;
  const recoverDisplayMonth =
    monthsAll[recoverDisplayIndex] || recoverMonth || drawdown.recoverMonth;
  const midIndex = Math.round((recoverDisplayIndex + latestVisibleIndex) / 2);

  return {
    ...drawdown,
    peakIndex: peakGlobalIndex,
    peakMonth: monthsAll[peakGlobalIndex] || drawdown.peakMonth,
    latestIndex: latestGlobalIndex,
    latestMonth: monthsAll[latestGlobalIndex] || drawdown.latestMonth,
    recoverIndex: recoverGlobalIndex,
    recoverMonth,
    recoverDisplayIndex,
    recoverDisplayMonth,
    recoverOutsideViewport: recoverGlobalIndex < visibleStart,
    midIndex,
    midMonth: monthsAll[midIndex] || drawdown.midMonth,
  };
}

function buildDrawdownHorizontalLayout(
  drawdown,
  {
    visibleStartIndex = 0,
    visibleEndIndex = 0,
    plotWidthPx = 1,
    halfGapPx = 22,
  } = {},
) {
  if (!drawdown) return null;
  const rawStartIndex = Number.isInteger(drawdown.recoverDisplayIndex)
    ? drawdown.recoverDisplayIndex
    : drawdown.recoverIndex;
  if (!Number.isInteger(rawStartIndex) || !Number.isInteger(drawdown.latestIndex)) return null;

  const safeVisibleStart = Math.max(0, Number.isInteger(visibleStartIndex) ? visibleStartIndex : 0);
  const safeVisibleEnd = Math.max(
    safeVisibleStart,
    Number.isInteger(visibleEndIndex) ? visibleEndIndex : safeVisibleStart,
  );
  const endIndex = Math.round(
    clampNumber(drawdown.latestIndex, safeVisibleStart, safeVisibleEnd),
  );
  if (rawStartIndex >= endIndex) return null;

  const startIndex = Math.round(
    clampNumber(rawStartIndex, safeVisibleStart, endIndex - 1),
  );
  const span = endIndex - startIndex;
  if (span < 1) return null;

  const labelCenterIndex = Math.round((startIndex + endIndex) / 2);
  const visibleSpan = Math.max(1, safeVisibleEnd - safeVisibleStart);
  const pxPerMonth = Math.max(1, plotWidthPx / visibleSpan);
  const halfGapMonthByPx = Math.max(1, Math.ceil(halfGapPx / pxPerMonth));
  const maxHalfGapByData = Math.max(1, Math.floor((span - 1) / 2));
  const halfGap = Math.min(maxHalfGapByData, halfGapMonthByPx);

  let leftBreakIndex = Math.max(startIndex, labelCenterIndex - halfGap);
  let rightBreakIndex = Math.min(endIndex, labelCenterIndex + halfGap);
  if (leftBreakIndex >= rightBreakIndex) {
    leftBreakIndex = Math.max(startIndex, labelCenterIndex - 1);
    rightBreakIndex = Math.min(endIndex, labelCenterIndex + 1);
  }

  if (leftBreakIndex <= startIndex && span >= 3) {
    leftBreakIndex = startIndex + 1;
  }
  if (rightBreakIndex >= endIndex && span >= 3) {
    rightBreakIndex = endIndex - 1;
  }

  return {
    startIndex,
    endIndex,
    labelCenterIndex,
    leftBreakIndex,
    rightBreakIndex,
  };
}

function findDrawdownAnalysis(values, months) {
  const latestIndex = getLastFiniteIndex(values);
  if (latestIndex <= 0) return null;

  const latestValue = values[latestIndex];
  let peakValue = Number.NEGATIVE_INFINITY;
  let peakIndex = -1;

  for (let i = 0; i < latestIndex; i += 1) {
    const value = values[i];
    if (!isFiniteNumber(value)) continue;
    if (value > peakValue) {
      peakValue = value;
      peakIndex = i;
    }
  }

  if (peakIndex < 0 || !isFiniteNumber(peakValue)) return null;

  const drawdownPct = calcPctChange(latestValue, peakValue);
  if (!isFiniteNumber(drawdownPct) || drawdownPct > -10) return null;

  const recoverIndex = findRecoverIndex(values, latestValue, peakIndex);
  if (recoverIndex < 0) return null;

  const midIndex = Math.floor((recoverIndex + latestIndex) / 2);
  return {
    peakIndex,
    peakMonth: months[peakIndex],
    peakValue,
    latestIndex,
    latestMonth: months[latestIndex],
    latestValue,
    recoverIndex,
    recoverMonth: months[recoverIndex],
    midIndex,
    midMonth: months[midIndex],
    drawdownPct,
  };
}

function updateDrawdownButton(eligibleCount) {
  const enabled = eligibleCount > 0;
  if (!enabled) {
    uiState.showDrawdownAnalysis = false;
  }

  drawdownBtn.disabled = !enabled;
  drawdownBtn.classList.toggle("enabled", enabled);

  if (!enabled) {
    drawdownBtn.textContent = "累计跌幅（不可用）";
    return;
  }

  drawdownBtn.textContent = uiState.showDrawdownAnalysis
    ? "累计跌幅（开启）"
    : "累计跌幅（关闭）";
}

function updateChartTableButton(eligibleCount) {
  const enabled = eligibleCount > 0;
  if (!enabled) {
    uiState.showChartTable = false;
  }

  chartTableBtn.disabled = !enabled;
  chartTableBtn.classList.toggle("enabled", enabled);

  if (!enabled) {
    chartTableBtn.textContent = "表格汇总（不可用）";
    return;
  }

  chartTableBtn.textContent = uiState.showChartTable
    ? "表格汇总（开启）"
    : "表格汇总（关闭）";
}

function renderChartStatsOverlay(rows, startMonth, endMonth) {
  if (!uiState.showChartTable || !Array.isArray(rows) || rows.length === 0) {
    chartStatsOverlayEl.classList.remove("show");
    chartStatsOverlayEl.innerHTML = "";
    syncChartViewport({ resizeChart: false });
    return;
  }

  const orderedRows = [...rows].sort((a, b) => {
    const aRank = OVERLAY_CITY_ORDER_INDEX.has(a.name)
      ? OVERLAY_CITY_ORDER_INDEX.get(a.name)
      : Number.MAX_SAFE_INTEGER;
    const bRank = OVERLAY_CITY_ORDER_INDEX.has(b.name)
      ? OVERLAY_CITY_ORDER_INDEX.get(b.name)
      : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.name).localeCompare(String(b.name), "zh-CN");
  });

  const bodyRows = orderedRows
    .map((row) => {
      const recoverText = row.recoverMonth ? row.recoverMonth.replace("-", ".") : "-";
      const drawdownText = isFiniteNumber(row.drawdownFromPeakPct)
        ? `${Math.abs(row.drawdownFromPeakPct).toFixed(1)}%`
        : "-";
      return `<tr>
        <td>${row.name}</td>
        <td>${formatNumber(row.peakValue, 1)}</td>
        <td>${formatNumber(row.latestValue, 1)}</td>
        <td>${drawdownText}</td>
        <td>${recoverText}</td>
      </tr>`;
    })
    .join("");

  chartStatsOverlayEl.innerHTML = `
    <div class="chart-stats-title-main">二手住宅价格指数：热点城市</div>
    <div class="chart-stats-title-sub">${formatMonthZh(startMonth)} - ${formatMonthZh(endMonth)}</div>
    <div class="chart-stats-title-sub">定基${formatMonthZh(startMonth)} = 100</div>
    <table>
    <thead>
      <tr>
        <th>中原领先指数</th>
        <th>最高位置</th>
        <th>当前位置</th>
        <th>累计跌幅</th>
        <th>跌回</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  <div class="chart-stats-note">*数据来源：Wind、中原</div>
  <div class="chart-stats-note">*图表制作：公众号 - 一座独立屋</div>
  `;
  chartStatsOverlayEl.classList.add("show");
  syncChartViewport({ resizeChart: false });
}

function renderSummaryTable(rows) {
  summaryBodyEl.innerHTML = "";
  for (const row of rows) {
    const tr = document.createElement("tr");
    const cells = [
      row.name,
      formatNumber(row.baseRaw, 2),
      `${formatNumber(row.peakValue, 1)} (${row.peakDate || "-"})`,
      `${formatNumber(row.latestValue, 1)} (${row.latestDate || "-"})`,
      formatPercent(row.momPct, 1),
      formatPercent(row.yoyPct, 1),
      formatPercent(row.drawdownFromPeakPct, 1),
    ];
    tr.innerHTML = cells.map((cell) => `<td>${cell}</td>`).join("");
    summaryBodyEl.appendChild(tr);
  }
}

function downloadByDataURL(dataURL, filename) {
  const anchor = document.createElement("a");
  anchor.href = dataURL;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

function drawOverlaySummaryOnCanvas(ctx, canvasWidth, canvasHeight, exportContext) {
  if (!uiState.showChartTable || !exportContext) return;
  const rows = Array.isArray(exportContext.visibleSummaryRows)
    ? exportContext.visibleSummaryRows
    : [];
  if (rows.length === 0) return;

  const orderedRows = [...rows].sort((a, b) => {
    const aRank = OVERLAY_CITY_ORDER_INDEX.has(a.name)
      ? OVERLAY_CITY_ORDER_INDEX.get(a.name)
      : Number.MAX_SAFE_INTEGER;
    const bRank = OVERLAY_CITY_ORDER_INDEX.has(b.name)
      ? OVERLAY_CITY_ORDER_INDEX.get(b.name)
      : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.name).localeCompare(String(b.name), "zh-CN");
  });

  const chartRect = chartEl.getBoundingClientRect();
  const overlayRect = chartStatsOverlayEl.getBoundingClientRect();
  if (!chartRect.width || !chartRect.height || !overlayRect.width || !overlayRect.height) return;

  const scaleX = canvasWidth / chartRect.width;
  const scaleY = canvasHeight / chartRect.height;
  const boxX = (overlayRect.left - chartRect.left) * scaleX;
  const boxY = (overlayRect.top - chartRect.top) * scaleY;
  const boxW = overlayRect.width * scaleX;
  const tableW = boxW * 1.2075;
  const tableX = boxX - (tableW - boxW) / 2;
  const centerX = boxX + boxW / 2;
  const fontFamily = '"STKaiti","Kaiti SC","KaiTi","BiauKai",serif';

  const mainFontSize = Math.max(16, Math.round(18 * scaleY));
  const subFontSize = Math.max(12, Math.round(13 * scaleY));
  const cellFontSize = Math.max(12, Math.round(13 * scaleY * OVERLAY_TABLE_SCALE));
  const noteFontSize = Math.max(10, Math.round(12 * scaleY));
  const titleColor = "#22282d";
  const lineColor = "#6f747a";

  let cursorY = boxY;
  ctx.fillStyle = titleColor;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";

  ctx.font = `700 ${mainFontSize}px ${fontFamily}`;
  ctx.fillText("二手住宅价格指数：热点城市", centerX, cursorY);
  cursorY += Math.round(mainFontSize * 1.24);

  ctx.font = `400 ${subFontSize}px ${fontFamily}`;
  ctx.fillText(
    `${formatMonthZh(exportContext.startMonth)} - ${formatMonthZh(exportContext.endMonth)}`,
    centerX,
    cursorY,
  );
  cursorY += Math.round(subFontSize * 1.24);
  ctx.fillText(`定基${formatMonthZh(exportContext.startMonth)} = 100`, centerX, cursorY);
  cursorY += Math.round(subFontSize * 1.72);

  const header = ["中原领先指数", "最高位置", "当前位置", "累计跌幅", "跌回"];
  const colRatios = [0.25, 0.19, 0.19, 0.19, 0.18];
  const colWidths = colRatios.map((ratio) => ratio * tableW);
  const rowHeight = Math.max(18, Math.round(cellFontSize * 1.35));
  const headerHeight = Math.max(19, Math.round(cellFontSize * 1.42));
  const topY = cursorY;

  ctx.strokeStyle = lineColor;
  ctx.lineWidth = Math.max(1, Math.round(scaleY));
  ctx.beginPath();
  ctx.moveTo(tableX, topY);
  ctx.lineTo(tableX + tableW, topY);
  ctx.stroke();

  const headerBottomY = topY + headerHeight;
  ctx.beginPath();
  ctx.moveTo(tableX, headerBottomY);
  ctx.lineTo(tableX + tableW, headerBottomY);
  ctx.stroke();

  ctx.font = `700 ${cellFontSize}px ${fontFamily}`;
  ctx.fillStyle = "#1f252a";
  let runningX = tableX;
  for (let i = 0; i < header.length; i += 1) {
    const midX = runningX + colWidths[i] / 2;
    ctx.fillText(header[i], midX, topY + Math.round((headerHeight - cellFontSize) / 2) - 1);
    runningX += colWidths[i];
  }

  ctx.font = `400 ${cellFontSize}px ${fontFamily}`;
  orderedRows.forEach((row, index) => {
    const rowTop = headerBottomY + index * rowHeight;
    const rowBottom = rowTop + rowHeight;
    const recoverText = row.recoverMonth ? row.recoverMonth.replace("-", ".") : "-";
    const drawdownText = isFiniteNumber(row.drawdownFromPeakPct)
      ? `${Math.abs(row.drawdownFromPeakPct).toFixed(1)}%`
      : "-";
    const cells = [
      row.name,
      formatNumber(row.peakValue, 1),
      formatNumber(row.latestValue, 1),
      drawdownText,
      recoverText,
    ];

    let colStartX = tableX;
    for (let i = 0; i < cells.length; i += 1) {
      const midX = colStartX + colWidths[i] / 2;
      ctx.fillText(
        String(cells[i]),
        midX,
        rowTop + Math.round((rowHeight - cellFontSize) / 2) - 1,
      );
      colStartX += colWidths[i];
    }

    if (index === orderedRows.length - 1) {
      ctx.beginPath();
      ctx.moveTo(tableX, rowBottom);
      ctx.lineTo(tableX + tableW, rowBottom);
      ctx.stroke();
    }
  });

  cursorY = headerBottomY + orderedRows.length * rowHeight + Math.round(8 * scaleY);
  ctx.font = `400 ${noteFontSize}px ${fontFamily}`;
  ctx.textAlign = "left";
  const noteLeftX = tableX - noteFontSize * 1.5;
  ctx.fillText("*数据来源：Wind、中原", noteLeftX, cursorY);
  ctx.fillText(
    "*图表制作：公众号 - 一座独立屋",
    noteLeftX,
    cursorY + Math.round(noteFontSize * 1.35),
  );
}

function exportCurrentChartImage(pixelRatio = 2, label = "标准清晰") {
  if (!latestRenderContext) {
    setStatus("暂无可导出的图表，请先生成。", true);
    return;
  }

  const chartDataUrl = chart.getDataURL({
    type: "png",
    pixelRatio,
    backgroundColor: "#ffffff",
    excludeComponents: ["toolbox", "dataZoom"],
  });
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setStatus("导出失败：无法创建画布。", true);
      return;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    drawOverlaySummaryOnCanvas(ctx, canvas.width, canvas.height, latestRenderContext);
    const suffix = pixelRatio >= 4 ? "-ultra-hd" : "";
    const filename = `house-price-base100-${latestRenderContext.startMonth}-to-${latestRenderContext.endMonth}${suffix}.png`;
    downloadByDataURL(canvas.toDataURL("image/png"), filename);
    setStatus(`图片已导出（${label}，含当前分析与表格设置）。`, false);
  };
  image.onerror = () => setStatus("导出失败，请重试。", true);
  image.src = chartDataUrl;
}

function getTextMeasureContext() {
  if (!textMeasureContext) {
    const measureCanvas = document.createElement("canvas");
    textMeasureContext = measureCanvas.getContext("2d");
  }
  return textMeasureContext;
}

function estimateLabelBox(lines, fontSize, padding, fontWeight = 700) {
  const safeLines = Array.isArray(lines) && lines.length > 0 ? lines : [""];
  const safePadding = Array.isArray(padding) && padding.length === 2 ? padding : [2, 4];
  const measureCtx = getTextMeasureContext();
  let maxLineWidth = 0;
  if (measureCtx) {
    measureCtx.font = `${fontWeight} ${fontSize}px ${CHART_FONT_FAMILY}`;
    safeLines.forEach((line) => {
      maxLineWidth = Math.max(maxLineWidth, measureCtx.measureText(String(line)).width);
    });
  } else {
    const fallbackWidth = Math.max(...safeLines.map((line) => String(line).length), 1);
    maxLineWidth = fallbackWidth * fontSize;
  }
  const lineHeight = Math.max(fontSize + 2, Math.round(fontSize * 1.2));
  return {
    width: Math.ceil(maxLineWidth + safePadding[1] * 2),
    height: Math.ceil(lineHeight * safeLines.length + safePadding[0] * 2),
  };
}

function buildLabelRect({
  anchorX,
  anchorY,
  width,
  height,
  position = "top",
  distance = 0,
  offsetX = 0,
  offsetY = 0,
}) {
  let x = anchorX - width / 2 + offsetX;
  let y = anchorY + offsetY;

  if (position === "top") {
    y = y - distance - height;
  } else if (position === "bottom") {
    y = y + distance;
  } else {
    y = y - height / 2;
  }

  return {
    x,
    y,
    width,
    height,
  };
}

function calcRectOverflow(rect, bounds) {
  const overflowLeft = Math.max(0, bounds.left - rect.x);
  const overflowRight = Math.max(0, rect.x + rect.width - bounds.right);
  const overflowTop = Math.max(0, bounds.top - rect.y);
  const overflowBottom = Math.max(0, rect.y + rect.height - bounds.bottom);
  return overflowLeft + overflowRight + overflowTop + overflowBottom;
}

function rectsOverlap(a, b, padding = 2) {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

function resolvePeakLabelLayouts(rendered, months, yMin, yMax, labelGapMonths) {
  const layoutMap = new Map();
  if (!Array.isArray(rendered) || rendered.length === 0 || !Array.isArray(months) || months.length === 0) {
    return layoutMap;
  }

  const chartWidth = chart.getWidth();
  const chartHeight = chart.getHeight();
  const plotBounds = {
    left: CHART_GRID_LAYOUT.left,
    right: Math.max(CHART_GRID_LAYOUT.left + 1, chartWidth - CHART_GRID_LAYOUT.right),
    top: CHART_GRID_LAYOUT.top,
    bottom: Math.max(CHART_GRID_LAYOUT.top + 1, chartHeight - CHART_GRID_LAYOUT.bottom),
  };
  const peakLabelBounds = {
    left: 8,
    right: Math.max(9, chartWidth - 8),
    top: 8,
    bottom: Math.max(9, chartHeight - 8),
  };
  const plotWidth = Math.max(1, plotBounds.right - plotBounds.left);
  const plotHeight = Math.max(1, plotBounds.bottom - plotBounds.top);
  const ySpan = Math.max(1e-6, yMax - yMin);
  const monthIndexMap = new Map(months.map((month, index) => [month, index]));

  function toPixelCoord(month, value) {
    const monthIndex = monthIndexMap.get(month);
    if (!Number.isInteger(monthIndex) || !isFiniteNumber(value)) return null;
    const xRatio = months.length > 1 ? monthIndex / (months.length - 1) : 0;
    const yRatio = clampNumber((value - yMin) / ySpan, 0, 1);
    return {
      x: plotBounds.left + xRatio * plotWidth,
      y: plotBounds.bottom - yRatio * plotHeight,
    };
  }

  const occupiedRects = [];

  const topCandidateStyles = [
    { position: "top", distance: 7, fontSize: 12, padding: [2, 6] },
    { position: "top", distance: 5, fontSize: 12, padding: [2, 6] },
    { position: "top", distance: 9, fontSize: 11, padding: [2, 5] },
    { position: "top", distance: 4, fontSize: 11, padding: [2, 5] },
    { position: "top", distance: 11, fontSize: 10, padding: [1, 4] },
  ];
  const fallbackCandidateStyles = [
    { position: "bottom", distance: 6, fontSize: 11, padding: [2, 5] },
    { position: "bottom", distance: 8, fontSize: 10, padding: [1, 4] },
  ];
  const candidateOffsetX = [0, -8, 8, -14, 14, -20, 20, -26, 26];
  const candidateOffsetY = [0, 3, -3, 6];
  const peakAnnotations = rendered
    .filter((item) => item.peakMarker && isFiniteNumber(item.peakMarker.value))
    .map((item) => {
      const coord = toPixelCoord(item.peakMarker.month, item.peakMarker.value);
      if (!coord) return null;
      return {
        cityName: item.name,
        monthText: item.peakMarker.month.replace("-", "."),
        anchorX: coord.x,
        anchorY: coord.y,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.anchorX - b.anchorX || b.anchorY - a.anchorY);

  peakAnnotations.forEach((annotation) => {
    const lines = ["最高点", annotation.monthText];
    let bestCandidate = null;

    const evaluateCandidates = (styles, styleRankOffset = 0) => {
      let best = null;
      let bestClear = null;
      let bestNoOverlap = null;

      for (let styleIndex = 0; styleIndex < styles.length; styleIndex += 1) {
        const style = styles[styleIndex];
        const labelBox = estimateLabelBox(lines, style.fontSize, style.padding, 700);

        for (const offsetX of candidateOffsetX) {
          for (const offsetY of candidateOffsetY) {
            const rect = buildLabelRect({
              anchorX: annotation.anchorX,
              anchorY: annotation.anchorY,
              width: labelBox.width,
              height: labelBox.height,
              position: style.position,
              distance: style.distance,
              offsetX,
              offsetY,
            });

            let overlapCount = 0;
            for (const occupied of occupiedRects) {
              if (rectsOverlap(rect, occupied, 3)) overlapCount += 1;
            }

            const overflow = calcRectOverflow(rect, peakLabelBounds);
            const score =
              overlapCount * 100000 +
              overflow * 120 +
              (styleRankOffset + styleIndex) * 40 +
              Math.abs(offsetX) * 8 +
              Math.abs(offsetY);

            const candidate = {
              score,
              style,
              offsetX,
              offsetY,
              rect,
              overlapCount,
              overflow,
            };

            if (!best || candidate.score < best.score) {
              best = candidate;
            }

            if (candidate.overlapCount === 0 && candidate.overflow === 0) {
              if (!bestClear || candidate.score < bestClear.score) {
                bestClear = candidate;
              }
            }

            if (candidate.overlapCount === 0) {
              if (
                !bestNoOverlap ||
                candidate.overflow < bestNoOverlap.overflow ||
                (candidate.overflow === bestNoOverlap.overflow &&
                  candidate.score < bestNoOverlap.score)
              ) {
                bestNoOverlap = candidate;
              }
            }
          }
        }
      }

      return {
        best,
        bestClear,
        bestNoOverlap,
      };
    };

    const topEval = evaluateCandidates(topCandidateStyles, 0);
    if (topEval.bestClear) {
      bestCandidate = topEval.bestClear;
    } else if (topEval.bestNoOverlap && topEval.bestNoOverlap.overflow <= 16) {
      bestCandidate = topEval.bestNoOverlap;
    } else {
      bestCandidate = topEval.best;
      const topHasUsablePlacement =
        topEval.bestNoOverlap && topEval.bestNoOverlap.overflow <= 26;
      if (!topHasUsablePlacement) {
        const fallbackEval = evaluateCandidates(
          fallbackCandidateStyles,
          topCandidateStyles.length,
        );
        if (fallbackEval.bestClear) {
          bestCandidate = fallbackEval.bestClear;
        } else if (fallbackEval.best && (!bestCandidate || fallbackEval.best.score < bestCandidate.score)) {
          bestCandidate = fallbackEval.best;
        }
      }
    }

    if (!bestCandidate) return;
    occupiedRects.push(bestCandidate.rect);
    layoutMap.set(annotation.cityName, {
      position: bestCandidate.style.position,
      distance: bestCandidate.style.distance,
      fontSize: bestCandidate.style.fontSize,
      padding: bestCandidate.style.padding,
      offset: [bestCandidate.offsetX, bestCandidate.offsetY],
    });
  });

  return layoutMap;
}

function buildPeakLabelRectList(rendered, peakLabelLayouts, toPixelCoord) {
  const rects = [];
  rendered.forEach((item) => {
    if (!item.peakMarker || !isFiniteNumber(item.peakMarker.value)) return;
    const coord = toPixelCoord(item.peakMarker.month, item.peakMarker.value);
    if (!coord) return;
    const layout = peakLabelLayouts.get(item.name);
    const labelText = [
      "最高点",
      String(item.peakMarker.month || "").replace("-", "."),
    ];
    const fontSize = layout?.fontSize ?? 12;
    const padding = layout?.padding || [2, 6];
    const labelBox = estimateLabelBox(labelText, fontSize, padding, 700);
    const rect = buildLabelRect({
      anchorX: coord.x,
      anchorY: coord.y,
      width: labelBox.width,
      height: labelBox.height,
      position: layout?.position || "top",
      distance: layout?.distance ?? 8,
      offsetX: Array.isArray(layout?.offset) ? (layout.offset[0] || 0) : 0,
      offsetY: Array.isArray(layout?.offset) ? (layout.offset[1] || 0) : 0,
    });
    rects.push(rect);
  });
  return rects;
}

function resolveDrawdownValueLabelOffset(anchorX, anchorY, peakLabelRects, chartBounds) {
  if (!Number.isFinite(anchorX) || !Number.isFinite(anchorY) || !Array.isArray(peakLabelRects)) {
    return [0, 0];
  }

  const labelLines = ["累计跌幅", "00.0%"];
  const labelBox = estimateLabelBox(labelLines, 14, [2, 4], 700);
  const offsetCandidates = [0, 12, -12, 18, -18, 26, -26, 34, -34, 44, -44];

  let best = null;
  for (const offsetY of offsetCandidates) {
    const rect = buildLabelRect({
      anchorX,
      anchorY,
      width: labelBox.width,
      height: labelBox.height,
      position: "inside",
      offsetY,
    });

    const overlapCount = peakLabelRects.reduce(
      (count, peakRect) => (rectsOverlap(rect, peakRect, 3) ? count + 1 : count),
      0,
    );
    const overflow = calcRectOverflow(rect, chartBounds);
    const score = overlapCount * 10000 + overflow * 100 + Math.abs(offsetY);
    if (!best || score < best.score) {
      best = { score, offsetY, overlapCount, overflow };
    }
    if (overlapCount === 0 && overflow === 0) break;
  }

  return best ? [0, best.offsetY] : [0, 0];
}

function makeOption(
  rendered,
  months,
  startMonth,
  endMonth,
  hiddenCityNames,
  zoomStartMonth,
  zoomEndMonth,
) {
  const zoomStartValue = typeof zoomStartMonth === "string" ? zoomStartMonth : undefined;
  const zoomEndValue = typeof zoomEndMonth === "string" ? zoomEndMonth : undefined;
  let visibleStartIndex = 0;
  let visibleEndIndex = Math.max(0, months.length - 1);
  if (typeof zoomStartValue === "string") {
    const idx = months.indexOf(zoomStartValue);
    if (idx >= 0) visibleStartIndex = idx;
  }
  if (typeof zoomEndValue === "string") {
    const idx = months.indexOf(zoomEndValue);
    if (idx >= 0) visibleEndIndex = idx;
  }
  if (visibleStartIndex > visibleEndIndex) {
    const temp = visibleStartIndex;
    visibleStartIndex = visibleEndIndex;
    visibleEndIndex = temp;
  }
  const selectedMap = Object.fromEntries(
    rendered.map((item) => [item.name, !hiddenCityNames.has(item.name)]),
  );
  const allFiniteValues = rendered.flatMap((item) => item.normalized.filter(isFiniteNumber));
  const yMin = allFiniteValues.length > 0 ? Math.min(...allFiniteValues) : 80;
  const yMax = allFiniteValues.length > 0 ? Math.max(...allFiniteValues) : 120;
  const yRange = Math.max(1, yMax - yMin);
  const usableChartHeight = Math.max(280, chart.getHeight() - 170);
  const verticalGap = Math.max(14, Math.min(30, (38 * yRange) / usableChartHeight));
  const usableChartWidth = Math.max(420, chart.getWidth() - 190);
  const labelGapMonths = Math.max(
    4,
    Math.round((92 * Math.max(1, months.length - 1)) / usableChartWidth),
  );
  const peakLabelLayouts = resolvePeakLabelLayouts(rendered, months, yMin, yMax, labelGapMonths);
  const chartWidth = chart.getWidth();
  const chartHeight = chart.getHeight();
  const xAxisLabelLayout = resolveXAxisLabelLayout(
    months,
    chartWidth,
    visibleStartIndex,
    visibleEndIndex,
  );
  const endLabelFontSize = chartWidth <= 520 ? 14 : chartWidth <= 760 ? 16 : 18;
  const legendFontSize = chartWidth <= 520 ? 12.5 : chartWidth <= 760 ? 13.5 : 15;
  const yAxisLabelFontSize = chartWidth <= 520 ? 12 : chartWidth <= 760 ? 13 : 14;
  const seriesLineWidth = chartWidth <= 520 ? 1.88 : chartWidth <= 760 ? 2.1 : 3.02;
  const markLineWidth = chartWidth <= 520 ? 1.15 : chartWidth <= 760 ? 1.32 : 2;
  const markSymbolSize = chartWidth <= 520 ? 8 : chartWidth <= 760 ? 9 : 10;
  const plotBounds = {
    left: CHART_GRID_LAYOUT.left,
    right: Math.max(CHART_GRID_LAYOUT.left + 1, chartWidth - CHART_GRID_LAYOUT.right),
    top: CHART_GRID_LAYOUT.top,
    bottom: Math.max(CHART_GRID_LAYOUT.top + 1, chartHeight - CHART_GRID_LAYOUT.bottom),
  };
  const plotWidth = Math.max(1, plotBounds.right - plotBounds.left);
  const plotHeight = Math.max(1, plotBounds.bottom - plotBounds.top);
  const ySpan = Math.max(1e-6, yMax - yMin);
  const monthIndexMap = new Map(months.map((month, index) => [month, index]));
  const toPixelCoord = (month, value) => {
    const monthIndex = monthIndexMap.get(month);
    if (!Number.isInteger(monthIndex) || !isFiniteNumber(value)) return null;
    const xRatio = months.length > 1 ? monthIndex / (months.length - 1) : 0;
    const yRatio = clampNumber((value - yMin) / ySpan, 0, 1);
    return {
      x: plotBounds.left + xRatio * plotWidth,
      y: plotBounds.bottom - yRatio * plotHeight,
    };
  };
  const labelBounds = {
    left: 8,
    right: Math.max(9, chartWidth - 8),
    top: 8,
    bottom: Math.max(9, chartHeight - 8),
  };
  const peakLabelRects = buildPeakLabelRectList(rendered, peakLabelLayouts, toPixelCoord);

  return {
    backgroundColor: "#ffffff",
    color: rendered.map((item) => item.color),
    animationDuration: 650,
    textStyle: {
      fontFamily: CHART_FONT_FAMILY,
      fontSize: 14,
      color: "#26333b",
    },
    tooltip: {
      trigger: "axis",
      textStyle: {
        fontFamily: CHART_FONT_FAMILY,
      },
      valueFormatter(value) {
        return isFiniteNumber(value) ? value.toFixed(1) : "-";
      },
    },
    legend: {
      bottom: 10,
      textStyle: {
        color: "#26333b",
        fontSize: legendFontSize,
        fontWeight: 700,
        fontFamily: CHART_FONT_FAMILY,
      },
      itemWidth: 20,
      itemHeight: 4,
      selected: selectedMap,
    },
    toolbox: {
      right: 8,
      top: 6,
      feature: {
        myExportImage: {
          show: true,
          title: "导出图片（标准）",
          icon: "path://M128 704h768v64H128zM480 128h64v352h112L512 640 368 480h112z",
          onclick: () => exportCurrentChartImage(2, "标准清晰"),
        },
        myExportImageUltra: {
          show: true,
          title: "导出图片（超清）",
          icon: "path://M128 704h768v64H128zM480 128h64v352h112L512 640 368 480h112z",
          onclick: () => exportCurrentChartImage(4, "超清"),
        },
      },
    },
    grid: {
      left: CHART_GRID_LAYOUT.left,
      right: CHART_GRID_LAYOUT.right,
      top: CHART_GRID_LAYOUT.top,
      bottom: CHART_GRID_LAYOUT.bottom,
    },
    dataZoom: [
      {
        type: "slider",
        xAxisIndex: 0,
        filterMode: "none",
        startValue: zoomStartValue,
        endValue: zoomEndValue,
        showDetail: false,
        brushSelect: false,
        bottom: 46,
        height: 18,
        borderColor: "rgba(0, 0, 0, 0)",
        backgroundColor: "rgba(0, 0, 0, 0)",
        fillerColor: "rgba(31, 109, 155, 0.12)",
        dataBackground: {
          lineStyle: {
            color: "rgba(0, 0, 0, 0)",
            width: 0,
          },
          areaStyle: {
            color: "rgba(0, 0, 0, 0)",
          },
        },
        selectedDataBackground: {
          lineStyle: {
            color: "rgba(0, 0, 0, 0)",
            width: 0,
          },
          areaStyle: {
            color: "rgba(31, 109, 155, 0.16)",
          },
        },
        moveHandleStyle: {
          color: "rgba(31, 109, 155, 0.24)",
        },
        handleSize: "112%",
        handleStyle: {
          color: "rgba(255, 255, 255, 0.72)",
          borderColor: "rgba(31, 109, 155, 0.72)",
          borderWidth: 1.2,
        },
        emphasis: {
          moveHandleStyle: {
            color: "rgba(31, 109, 155, 0.3)",
          },
          handleStyle: {
            color: "rgba(255, 255, 255, 0.9)",
            borderColor: "rgba(31, 109, 155, 0.86)",
            borderWidth: 1.4,
          },
        },
        textStyle: {
          color: "rgba(0, 0, 0, 0)",
        },
      },
    ],
    xAxis: {
      type: "category",
      data: months,
      axisTick: {
        show: chartWidth > 760,
        interval: 0,
        length: chartWidth <= 520 ? 4 : 5,
      },
      axisLine: { lineStyle: { color: "#8b8d90" } },
      axisLabel: {
        color: "#36454f",
        interval: 0,
        margin: xAxisLabelLayout.margin,
        rotate: xAxisLabelLayout.rotate,
        fontSize: xAxisLabelLayout.fontSize,
        fontWeight: 800,
        hideOverlap: false,
        showMinLabel: true,
        showMaxLabel: true,
        fontFamily: CHART_FONT_FAMILY,
        formatter(value, index) {
          return xAxisLabelLayout.isLabelVisible(value, index) ? value : "";
        },
      },
    },
    yAxis: {
      type: "value",
      min: function (value) {
        return Math.floor((value.min - 5) / 10) * 10;
      },
      max: function (value) {
        return Math.ceil((value.max + 5) / 10) * 10;
      },
      axisLine: { show: true, lineStyle: { color: "#547086", width: 1.5 } },
      axisTick: { show: true, inside: true },
      splitLine: { show: false },
      axisLabel: {
        color: "#304451",
        fontSize: yAxisLabelFontSize,
        fontWeight: 600,
        fontFamily: CHART_FONT_FAMILY,
        formatter(value) {
          return Number(value).toFixed(0);
        },
      },
    },
    series: rendered.map((item) => {
      const drawdown = item.drawdown;
      const peakMarker = item.peakMarker;
      const peakLabelLayout = peakLabelLayouts.get(item.name);
      const markLineData = [];
      const markPointData = [];

      if (peakMarker) {
        markPointData.push({
          coord: [peakMarker.month, peakMarker.value],
          symbol: "circle",
          symbolSize: 2,
          itemStyle: {
            color: "rgba(0,0,0,0)",
            borderColor: "rgba(0,0,0,0)",
            borderWidth: 0,
          },
          label: {
            show: true,
            position: peakLabelLayout?.position || "top",
            distance: peakLabelLayout?.distance ?? 8,
            align: "center",
            color: item.color,
            fontFamily: CHART_FONT_FAMILY,
            fontSize: peakLabelLayout?.fontSize ?? 12,
            fontWeight: 700,
            backgroundColor: CHART_TEXT_MASK_COLOR,
            padding: peakLabelLayout?.padding || [2, 6],
            offset: peakLabelLayout?.offset || [0, 0],
            formatter: `最高点\n${peakMarker.month.replace("-", ".")}`,
          },
        });
      }

      if (drawdown) {
        const verticalMid = (drawdown.peakValue + drawdown.latestValue) / 2;
        const upperSegmentEnd = verticalMid + verticalGap / 2;
        const lowerSegmentStart = verticalMid - verticalGap / 2;
        const drawdownLabelAnchor = toPixelCoord(drawdown.peakMonth, verticalMid);
        const drawdownLabelOffset = drawdownLabelAnchor
          ? resolveDrawdownValueLabelOffset(
              drawdownLabelAnchor.x,
              drawdownLabelAnchor.y,
              peakLabelRects,
              labelBounds,
            )
          : [0, 0];

        markLineData.push([
          {
            coord: [drawdown.peakMonth, drawdown.peakValue],
            symbol: "none",
          },
          {
            coord: [drawdown.peakMonth, upperSegmentEnd],
            symbol: "none",
          },
        ]);

        markPointData.push({
          coord: [drawdown.peakMonth, verticalMid],
          symbol: "circle",
          symbolSize: 2,
          itemStyle: {
            color: "rgba(0,0,0,0)",
            borderColor: "rgba(0,0,0,0)",
            borderWidth: 0,
          },
          label: {
            show: true,
            position: "inside",
            distance: 0,
            align: "center",
            verticalAlign: "middle",
            color: item.color,
            fontFamily: CHART_FONT_FAMILY,
            fontSize: 14,
            fontWeight: 700,
            backgroundColor: CHART_TEXT_MASK_COLOR,
            padding: [2, 4],
            offset: drawdownLabelOffset,
            formatter: `累计跌幅\n${Math.abs(drawdown.drawdownPct).toFixed(1)}%`,
          },
        });

        const recoverLabelText = drawdown.recoverMonth
          ? `跌回 ${drawdown.recoverMonth.replace("-", ".")}`
          : "跌回 -";
        const recoverLabelBox = estimateLabelBox([recoverLabelText], 14, [1, 2], 700);
        const horizontalLayout = buildDrawdownHorizontalLayout(drawdown, {
          visibleStartIndex,
          visibleEndIndex,
          plotWidthPx: plotWidth,
          halfGapPx: Math.ceil(recoverLabelBox.width / 2 + 8),
        });
        const hasHorizontalLayout = Boolean(horizontalLayout);
        const recoverDisplayMonth = hasHorizontalLayout
          ? months[horizontalLayout.startIndex] || drawdown.recoverDisplayMonth || drawdown.recoverMonth
          : null;
        const labelCenterIndex = hasHorizontalLayout ? horizontalLayout.labelCenterIndex : -1;
        const shouldShortVerticalArrow = hasHorizontalLayout
          ? (
              drawdown.peakIndex >= horizontalLayout.leftBreakIndex &&
              drawdown.peakIndex <= horizontalLayout.rightBreakIndex
            )
          : false;
        const arrowTipClearance = Math.max(1.2, verticalGap * 0.18);
        let verticalArrowEnd = drawdown.latestValue;
        if (shouldShortVerticalArrow) {
          const shortenedEnd = Math.min(
            drawdown.latestValue + arrowTipClearance,
            lowerSegmentStart - 0.8,
          );
          if (shortenedEnd > drawdown.latestValue) {
            verticalArrowEnd = shortenedEnd;
          }
        }

        markLineData.push([
          {
            coord: [drawdown.peakMonth, lowerSegmentStart],
            symbol: "none",
          },
          {
            coord: [drawdown.peakMonth, verticalArrowEnd],
            symbol: "arrow",
          },
        ]);

        if (hasHorizontalLayout && recoverDisplayMonth) {
          markLineData.push([
            {
              coord: [months[horizontalLayout.leftBreakIndex], drawdown.latestValue],
              symbol: "none",
            },
            {
              coord: [recoverDisplayMonth, drawdown.latestValue],
              symbol: "arrow",
            },
          ]);
          markLineData.push([
            {
              coord: [months[horizontalLayout.rightBreakIndex], drawdown.latestValue],
              symbol: "none",
            },
            {
              coord: [drawdown.latestMonth, drawdown.latestValue],
              symbol: "arrow",
            },
          ]);
          markPointData.push({
            coord: [months[labelCenterIndex], drawdown.latestValue],
            symbol: "circle",
            symbolSize: 2,
            itemStyle: {
              color: "rgba(0,0,0,0)",
              borderColor: "rgba(0,0,0,0)",
              borderWidth: 0,
            },
            label: {
              show: true,
              position: "inside",
              distance: 0,
              align: "center",
              verticalAlign: "middle",
              color: item.color,
              fontFamily: CHART_FONT_FAMILY,
              fontSize: 14,
              fontWeight: 700,
              backgroundColor: CHART_TEXT_MASK_COLOR,
              padding: [1, 2],
              formatter: recoverLabelText,
            },
          });
        }
      }

      return {
        name: item.name,
        type: "line",
        triggerLineEvent: true,
        data: item.normalized,
        smooth: 0.15,
        showSymbol: false,
        connectNulls: false,
        lineStyle: {
          width: seriesLineWidth * (item.lineWidthScale || 1),
          color: item.color,
          type: item.lineType || "solid",
          opacity: item.lineOpacity ?? 1,
        },
        itemStyle: {
          color: item.color,
        },
        endLabel: {
          show: true,
          formatter: "{a}",
          color: item.color,
          fontWeight: 700,
          fontFamily: CHART_FONT_FAMILY,
          fontSize: endLabelFontSize,
          backgroundColor: CHART_TEXT_MASK_COLOR,
          padding: [1, 5],
        },
        labelLayout: {
          moveOverlap: "shiftY",
        },
        markLine:
          markLineData.length > 0
            ? {
                lineStyle: {
                  type: "dashed",
                  width: markLineWidth,
                  color: item.color,
                  opacity: 1,
                },
                label: { show: false },
                data: markLineData,
                silent: true,
                symbolSize: markSymbolSize,
              }
            : undefined,
        markPoint:
          markPointData.length > 0
            ? {
                symbol: "circle",
                symbolSize: 2,
                itemStyle: {
                  color: "rgba(0,0,0,0)",
                  borderColor: "rgba(0,0,0,0)",
                  borderWidth: 0,
                },
                z: 9,
                silent: true,
                data: markPointData,
              }
            : undefined,
        emphasis: {
          focus: "none",
        },
      };
    }),
  };
}

function render() {
  syncChartViewport();
  latestRenderContext = null;
  const selectedCityIds = readSelectedCityIds();
  refreshCompareSourceControl({ keepSelection: true });
  const compareContext = resolveCompareContext(selectedCityIds);
  const requestedStartMonth = startMonthEl.value;
  const requestedEndMonth = endMonthEl.value;

  if (selectedCityIds.length === 0) {
    chart.clear();
    summaryBodyEl.innerHTML = "";
    footnoteEl.textContent = "";
    updateDrawdownButton(0);
    updateChartTableButton(0);
    renderChartStatsOverlay([], requestedStartMonth, requestedEndMonth);
    setStatus("请至少选择一个城市。", true);
    return;
  }

  if (selectedCityIds.length > MAX_SELECTED_CITY_COUNT) {
    setStatus(`一次最多选择 ${MAX_SELECTED_CITY_COUNT} 个城市，请减少勾选后再生成。`, true);
    return;
  }

  if (
    !requestedStartMonth ||
    !requestedEndMonth ||
    requestedStartMonth > requestedEndMonth
  ) {
    chart.clear();
    summaryBodyEl.innerHTML = "";
    footnoteEl.textContent = "";
    updateDrawdownButton(0);
    updateChartTableButton(0);
    renderChartStatsOverlay([], requestedStartMonth, requestedEndMonth);
    setStatus("时间区间无效，请确保起点不晚于终点。", true);
    return;
  }

  const requestedStartIndex = raw.dates.indexOf(requestedStartMonth);
  const requestedEndIndex = raw.dates.indexOf(requestedEndMonth);
  if (requestedStartIndex < 0 || requestedEndIndex < 0) {
    setStatus("时间索引错误，请重新选择区间。", true);
    return;
  }

  const effectiveRange = getSelectedEffectiveRange(selectedCityIds);

  if (!effectiveRange) {
    chart.clear();
    summaryBodyEl.innerHTML = "";
    footnoteEl.textContent = "";
    updateDrawdownButton(0);
    updateChartTableButton(0);
    renderChartStatsOverlay([], requestedStartMonth, requestedEndMonth);
    setStatus("所选城市不存在可用的有效数据区间。", true);
    return;
  }

  let startIndex = requestedStartIndex;
  let endIndex = requestedEndIndex;
  let wasAutoAdjusted = false;

  if (startIndex < effectiveRange.startIndex) {
    startIndex = effectiveRange.startIndex;
    wasAutoAdjusted = true;
  }
  if (endIndex > effectiveRange.endIndex) {
    endIndex = effectiveRange.endIndex;
    wasAutoAdjusted = true;
  }
  if (startIndex > endIndex) {
    startIndex = effectiveRange.startIndex;
    endIndex = effectiveRange.endIndex;
    wasAutoAdjusted = true;
  }

  const startMonth = raw.dates[startIndex];
  const endMonth = raw.dates[endIndex];
  if (wasAutoAdjusted) {
    startMonthEl.value = startMonth;
    endMonthEl.value = endMonth;
  }

  const months = raw.dates.slice(startIndex, endIndex + 1);
  let viewportStartOffset = 0;
  let viewportEndOffset = months.length - 1;
  if (typeof uiState.zoomStartMonth === "string") {
    const idx = months.indexOf(uiState.zoomStartMonth);
    if (idx >= 0) viewportStartOffset = idx;
  }
  if (typeof uiState.zoomEndMonth === "string") {
    const idx = months.indexOf(uiState.zoomEndMonth);
    if (idx >= 0) viewportEndOffset = idx;
  }
  if (viewportStartOffset > viewportEndOffset) {
    viewportStartOffset = 0;
    viewportEndOffset = months.length - 1;
  }
  const viewportMonths = months.slice(viewportStartOffset, viewportEndOffset + 1);
  const viewportStartMonth = viewportMonths[0] || startMonth;
  const viewportEndMonth = viewportMonths[viewportMonths.length - 1] || endMonth;
  uiState.zoomStartMonth = viewportStartMonth;
  uiState.zoomEndMonth = viewportEndMonth;

  const rendered = [];
  const missingBase = [];
  const noDataCities = [];
  const summaryRows = [];
  let drawdownEligibleCount = 0;

  const activeSourceLegend = activeSourceMeta?.legendLabel || activeSourceMeta?.label || "当前源";
  const compareSourceLegend = compareContext?.source?.legendLabel || compareContext?.source?.label || "对比源";
  let compareSeriesRendered = false;

  function appendSeries({
    city,
    seriesRaw,
    displayName,
    colorIndex,
    lineType = "solid",
    lineWidthScale = 1,
    lineOpacity = 1,
    allowAnnotations = true,
  }) {
    const baseRaw = seriesRaw[viewportStartOffset];
    if (!isFiniteNumber(baseRaw) || baseRaw <= 0) {
      missingBase.push(displayName);
      return false;
    }
    const normalized = seriesRaw.map((value) => {
      if (!isFiniteNumber(value)) return null;
      return (value / baseRaw) * 100;
    });
    const viewportNormalized = normalized.slice(viewportStartOffset, viewportEndOffset + 1);

    const validValues = viewportNormalized.filter(isFiniteNumber);
    if (validValues.length === 0) {
      noDataCities.push(displayName);
    }

    const peakValue = validValues.length > 0 ? Math.max(...validValues) : null;
    const peakIndex = isFiniteNumber(peakValue)
      ? viewportNormalized.findIndex((v) => v === peakValue)
      : -1;
    const peakMonth = peakIndex >= 0 ? viewportMonths[peakIndex] : null;
    const latestIndex = getLastFiniteIndex(viewportNormalized);
    const { value: latestValue, date: latestDate } = getLastFiniteInfo(viewportNormalized, viewportMonths);
    const momPct =
      latestIndex > 0 ? calcPctChange(latestValue, viewportNormalized[latestIndex - 1]) : null;
    const yoyPct =
      latestIndex >= 12 ? calcPctChange(latestValue, viewportNormalized[latestIndex - 12]) : null;
    const drawdownFromPeakPct =
      isFiniteNumber(latestValue) && isFiniteNumber(peakValue)
        ? ((latestValue / peakValue) - 1) * 100
        : null;
    const localDrawdownAnalysis = findDrawdownAnalysis(viewportNormalized, viewportMonths);
    const drawdownAnalysis = localDrawdownAnalysis
      ? decorateDrawdownForViewport(
          localDrawdownAnalysis,
          normalized,
          months,
          viewportStartOffset,
          viewportEndOffset,
        )
      : null;
    if (allowAnnotations && drawdownAnalysis) {
      drawdownEligibleCount += 1;
    }

    const lineColor = getColor(city.name, colorIndex);
    rendered.push({
      id: city.id,
      name: displayName,
      color: lineColor,
      normalized,
      lineType,
      lineWidthScale,
      lineOpacity,
      peakMarker:
        uiState.showDrawdownAnalysis && allowAnnotations && peakMonth && isFiniteNumber(peakValue)
          ? {
              month: peakMonth,
              value: peakValue,
            }
          : null,
      drawdown: uiState.showDrawdownAnalysis && allowAnnotations ? drawdownAnalysis : null,
    });

    summaryRows.push({
      name: displayName,
      baseRaw,
      peakValue,
      peakDate: peakMonth,
      latestValue,
      latestDate,
      momPct,
      yoyPct,
      drawdownFromPeakPct,
      recoverMonth: drawdownAnalysis?.recoverMonth || null,
    });
    return true;
  }

  selectedCityIds.forEach((cityId, idx) => {
    const city = cityById.get(cityId);
    const series = raw.values[cityId];
    if (!city || !Array.isArray(series)) return;

    const displayName =
      compareContext && selectedCityIds.length === 1 && city.name === compareContext.cityName
        ? `${city.name}（${activeSourceLegend}）`
        : city.name;

    appendSeries({
      city,
      seriesRaw: series.slice(startIndex, endIndex + 1),
      displayName,
      colorIndex: idx,
      lineType: "solid",
      lineWidthScale: 1,
      lineOpacity: 1,
      allowAnnotations: true,
    });
  });

  if (compareContext) {
    const compareSeries = compareContext.source?.data?.values?.[compareContext.city.id];
    if (Array.isArray(compareSeries)) {
      compareSeriesRendered = appendSeries({
        city: compareContext.city,
        seriesRaw: alignSeriesByMonths(compareContext.source.data, compareSeries, months),
        displayName: `${compareContext.cityName}（${compareSourceLegend}）`,
        colorIndex: selectedCityIds.length + 1,
        lineType: "dashed",
        lineWidthScale: 0.94,
        lineOpacity: 0.96,
        allowAnnotations: false,
      });
    }
  }

  if (rendered.length === 0) {
    chart.clear();
    summaryBodyEl.innerHTML = "";
    footnoteEl.textContent = "";
    updateDrawdownButton(0);
    updateChartTableButton(0);
    renderChartStatsOverlay([], viewportStartMonth, viewportEndMonth);
    setStatus("所选城市在起点月份没有可用数据，无法按统一起点定基。", true);
    return;
  }

  const renderedNameSet = new Set(rendered.map((item) => item.name));
  uiState.hiddenCityNames = new Set(
    [...uiState.hiddenCityNames].filter((name) => renderedNameSet.has(name)),
  );
  const visibleSummaryRows = summaryRows.filter((row) => !uiState.hiddenCityNames.has(row.name));
  latestRenderContext = {
    startMonth: viewportStartMonth,
    endMonth: viewportEndMonth,
    visibleSummaryRows,
  };

  updateDrawdownButton(drawdownEligibleCount);
  updateChartTableButton(rendered.length);

  isApplyingOption = true;
  chart.setOption(
    makeOption(
      rendered,
      months,
      startMonth,
      endMonth,
      uiState.hiddenCityNames,
      viewportStartMonth,
      viewportEndMonth,
    ),
    { notMerge: true, lazyUpdate: false },
  );
  isApplyingOption = false;
  for (let i = 0; i < rendered.length; i += 1) {
    chart.dispatchAction({ type: "downplay", seriesIndex: i });
  }
  chart.dispatchAction({ type: "hideTip" });
  chart.dispatchAction({ type: "updateAxisPointer", currTrigger: "leave" });
  chartTitleEl.textContent = `热点城市二手房价格走势图`;
  const sourceLabelShort = activeSourceMeta?.label || "中原领先指数（6城）";
  const compareMetaText =
    compareContext && compareSeriesRendered
      ? ` | 对比 ${compareContext.cityName}（${activeSourceLegend} vs ${compareSourceLegend}）`
      : "";
  chartMetaEl.textContent = `${formatMonthZh(viewportStartMonth)} - ${formatMonthZh(viewportEndMonth)} | 定基 ${formatMonthZh(viewportStartMonth)} = 100 | ${sourceLabelShort}${compareMetaText}`;

  renderSummaryTable(visibleSummaryRows);
  renderChartStatsOverlay(visibleSummaryRows, viewportStartMonth, viewportEndMonth);

  const missingText = missingBase.length > 0
    ? `以下城市因起点无有效值未纳入绘图：${missingBase.join("、")}。`
    : "";
  const noDataText = noDataCities.length > 0
    ? `以下城市在当前区间暂无有效值：${noDataCities.join("、")}。`
    : "";
  const modeText = `已按滑块起点 ${viewportStartMonth} 统一定基 100。`;
  const analysisText = uiState.showDrawdownAnalysis
    ? "已显示累计跌幅与跌回示意。"
    : "";
  const compareText =
    compareContext && compareSeriesRendered
      ? `已开启 ${compareContext.cityName} 跨源对比（${activeSourceLegend} vs ${compareSourceLegend}）。`
      : "";
  const sourceLabel = activeSourceMeta?.sourceTitle || "中原领先指数（月度）";
  footnoteEl.textContent = `数据源：${sourceLabel}。${modeText}${compareText}当前滑块区间：${viewportStartMonth} ~ ${viewportEndMonth}。${analysisText}${missingText}${noDataText}`;

  const compareStatusText =
    compareContext && compareSeriesRendered
      ? `，并已对比 ${compareContext.cityName}（${activeSourceLegend} vs ${compareSourceLegend}）`
      : "";
  const statusMessage = wasAutoAdjusted
    ? `你选择的区间超出有效数据范围，已自动调整为 ${startMonth} ~ ${endMonth}；当前滑块区间 ${viewportStartMonth} ~ ${viewportEndMonth}（定基 ${viewportStartMonth}=100）${compareStatusText}。`
    : `已生成 ${rendered.length} 条走势（当前滑块区间 ${viewportStartMonth} ~ ${viewportEndMonth}，定基 ${viewportStartMonth}=100）${compareStatusText}。`;
  setStatus(statusMessage, false);
}

function bindEvents() {
  if (dataSourceEl) {
    dataSourceEl.addEventListener("change", () => {
      const applied = applyDataSource(dataSourceEl.value);
      if (!applied) {
        setStatus("数据源切换失败，请刷新重试。", true);
        return;
      }
      render();
    });
  }

  if (compareSourceEl) {
    compareSourceEl.addEventListener("change", () => {
      refreshCompareSourceControl({ keepSelection: true });
      render();
    });
  }

  renderBtn.addEventListener("click", () => {
    uiState.hiddenCityNames.clear();
    render();
  });

  drawdownBtn.addEventListener("click", () => {
    if (drawdownBtn.disabled) return;
    uiState.showDrawdownAnalysis = !uiState.showDrawdownAnalysis;
    render();
  });

  chartTableBtn.addEventListener("click", () => {
    if (chartTableBtn.disabled) return;
    uiState.showChartTable = !uiState.showChartTable;
    render();
  });

  chart.on("click", (params) => {
    if (params?.componentType === "series" && params?.seriesName) {
      toggleCityVisibility(params.seriesName);
      render();
      return;
    }
  });

  chart.on("legendselectchanged", (params) => {
    if (isApplyingOption) return;
    const hidden = new Set();
    for (const [name, selected] of Object.entries(params.selected || {})) {
      if (!selected) hidden.add(name);
    }
    uiState.hiddenCityNames = hidden;
    render();
  });

  chart.on("dataZoom", () => {
    if (isApplyingOption || isSyncingRangeFromSlider) return;
    if (dataZoomSyncTimer) {
      clearTimeout(dataZoomSyncTimer);
      dataZoomSyncTimer = null;
    }

    dataZoomSyncTimer = setTimeout(() => {
      const option = chart.getOption();
      const axisData = option?.xAxis?.[0]?.data;
      const zoomList = option?.dataZoom;
      if (!Array.isArray(axisData) || axisData.length === 0 || !Array.isArray(zoomList)) return;

      const sliderZoom =
        zoomList.find((item) => item?.type === "slider") ||
        zoomList.find((item) => Number(item?.xAxisIndex) === 0) ||
        zoomList[0];
      if (!sliderZoom) return;

      const nextStartMonth = resolveAxisMonthFromZoomValue(
        sliderZoom.startValue,
        sliderZoom.start,
        axisData,
      );
      const nextEndMonth = resolveAxisMonthFromZoomValue(
        sliderZoom.endValue,
        sliderZoom.end,
        axisData,
      );
      if (!nextStartMonth || !nextEndMonth || nextStartMonth > nextEndMonth) return;

      if (
        uiState.zoomStartMonth === nextStartMonth &&
        uiState.zoomEndMonth === nextEndMonth
      ) {
        return;
      }

      uiState.zoomStartMonth = nextStartMonth;
      uiState.zoomEndMonth = nextEndMonth;

      isSyncingRangeFromSlider = true;
      try {
        render();
      } finally {
        isSyncingRangeFromSlider = false;
      }
    }, 90);
  });

  cityListEl.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.type !== "checkbox") return;

    const passed = enforceCitySelectionLimit(target);
    refreshCompareSourceControl({ keepSelection: true });
    if (!passed) {
      setStatus(`一次最多选择 ${MAX_SELECTED_CITY_COUNT} 个城市。`, true);
    }
  });

  selectAllBtn.addEventListener("click", () => {
    let selectedCount = 0;
    cityListEl.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      if (selectedCount < MAX_SELECTED_CITY_COUNT) {
        el.checked = true;
        selectedCount += 1;
      } else {
        el.checked = false;
      }
    });
    refreshCompareSourceControl({ keepSelection: true });
    setStatus(`已选择前 ${MAX_SELECTED_CITY_COUNT} 个城市。`, false);
  });

  clearAllBtn.addEventListener("click", () => {
    cityListEl.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.checked = false;
    });
    refreshCompareSourceControl({ keepSelection: false });
  });

  startMonthEl.addEventListener("change", () => {
    if (startMonthEl.value > endMonthEl.value) endMonthEl.value = startMonthEl.value;
  });

  endMonthEl.addEventListener("change", () => {
    if (endMonthEl.value < startMonthEl.value) startMonthEl.value = endMonthEl.value;
  });

  window.addEventListener("resize", () => {
    syncChartViewport();
    if (resizeRenderTimer) {
      clearTimeout(resizeRenderTimer);
      resizeRenderTimer = null;
    }
    resizeRenderTimer = setTimeout(() => {
      render();
    }, 120);
  });
}

function init() {
  const availableSources = listAvailableSources();
  if (availableSources.length === 0) {
    setStatus("数据加载失败，请先生成 house-price-data.js / house-price-data-nbs-70.js。", true);
    return;
  }

  populateSourceSelector(availableSources);
  const defaultSource =
    availableSources.find((source) => source.key === "centaline6") || availableSources[0];
  const applied = applyDataSource(defaultSource.key);
  if (!applied) {
    setStatus("初始化数据源失败，请刷新页面重试。", true);
    return;
  }

  bindEvents();
  bindChartWheelToPageScroll();
  render();
}

init();
