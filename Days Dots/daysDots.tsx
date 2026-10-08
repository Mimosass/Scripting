import type { Color } from "scripting"
import {
  VStack,
  HStack,
  Text,
  Circle,
  Grid,
  GridRow,
  Spacer,
} from "scripting"
import * as Scripting from "scripting"

// 真实 iOS App 环境里 Storage 由 scripting 原生提供；scripting-ts 预览/校验沙箱不含该桥。
// 优先用原生 Storage，缺失时降级到内存（保证预览与 widget 渲染不崩）。
function getStorage(): { get(key: string): any; set(key: string, value: any): any } | null {
  try {
    const s = (Scripting as any).Storage
    if (s && typeof s.get === "function" && typeof s.set === "function") return s
  } catch {
    /* ignore */
  }
  return null
}

let memoryConfig: Config | null = null

// ---------- Types ----------

export type Mode = "year" | "month"
export type ColorPair = { light: Color; dark: Color }

export interface Config {
  progressType: Mode
  weekStartsOn: 0 | 1
  showPercent: boolean
  active: ColorPair
  inactive: ColorPair
  background: ColorPair
}

export type Scheme = "light" | "dark"
export type Family = "systemSmall" | "systemMedium" | "systemLarge"

export interface Size {
  width: number
  height: number
}

export interface DaysData {
  mode: Mode
  total: number
  elapsed: number
  remaining: number
  title: string
  /** month: leading blanks + per-day cells; year: one cell per day */
  cells: ("filled" | "empty" | "blank")[]
}

// ---------- Defaults ----------

export const STORAGE_KEY = "daysDotsConfig"

export const DEFAULT_CONFIG: Config = {
  progressType: "year",
  weekStartsOn: 0,
  showPercent: true,
  active: { light: "#FF9500", dark: "#FF9F0A" },
  inactive: { light: "#D1D1D6", dark: "#3A3A3C" },
  background: { light: "#FFFFFF", dark: "#000000" },
}

export const PREVIEW_SIZES: Record<Family, Size> = {
  systemSmall: { width: 158, height: 158 },
  systemMedium: { width: 338, height: 158 },
  systemLarge: { width: 338, height: 354 },
}

// ---------- Storage ----------

export function loadConfig(): Config {
  const stored = getStorage()?.get(STORAGE_KEY)
  const base = stored ?? memoryConfig ?? null
  if (!base) return { ...DEFAULT_CONFIG }
  return {
    ...DEFAULT_CONFIG,
    ...base,
    active: { ...DEFAULT_CONFIG.active, ...(base.active ?? {}) },
    inactive: { ...DEFAULT_CONFIG.inactive, ...(base.inactive ?? {}) },
    background: { ...DEFAULT_CONFIG.background, ...(base.background ?? {}) },
  }
}

export function saveConfig(config: Config): void {
  memoryConfig = config
  getStorage()?.set(STORAGE_KEY, config)
}

// ---------- Computation ----------

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function computeData(mode: Mode, weekStartsOn: 0 | 1): DaysData {
  const now = new Date()

  if (mode === "month") {
    const y = now.getFullYear()
    const m = now.getMonth()
    const total = new Date(y, m + 1, 0).getDate()
    const today = now.getDate()
    const firstDay = new Date(y, m, 1).getDay() // 0=Sun..6=Sat
    const leading = (((firstDay - weekStartsOn) % 7) + 7) % 7

    const cells: ("filled" | "empty" | "blank")[] = []
    for (let i = 0; i < leading; i++) cells.push("blank")
    for (let d = 1; d <= total; d++) {
      cells.push(d <= today ? "filled" : "empty")
    }

    const elapsed = today
    const remaining = total - today
    const title = now.toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    })
    return { mode, total, elapsed, remaining, title, cells }
  }

  // year
  const y = now.getFullYear()
  const total = isLeapYear(y) ? 366 : 365
  const start = new Date(y, 0, 1)
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000) + 1
  const elapsed = dayOfYear
  const remaining = total - dayOfYear

  const cells: ("filled" | "empty" | "blank")[] = []
  for (let i = 0; i < total; i++) {
    cells.push(i < elapsed ? "filled" : "empty")
  }

  const title = String(y)
  return { mode, total, elapsed, remaining, title, cells }
}

// ---------- Layout ----------

interface Metrics {
  pad: number
  gapHeader: number
  gapWD: number
  headerH: number
  weekdayH: number
  titleFont: any
  pctFont: any
  wdFont: any
  spacing: number
}

// 基于组件真实尺寸自适应所有布局参数，不再按 family 三档硬编码。
// 这样小/中/大以及任意 displaySize 都能合理呈现：尺寸越小，留白、间距、字体越小。
function metrics(size: Size): Metrics {
  const w = size.width
  const h = size.height
  const s = Math.max(1, Math.min(w, h)) // 以较小边为基准比例

  // 比例系数：以 158pt（小/中正方形基准）为 1.0，尺度化其余参数。
  const k = s / 158

  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

  const pad = clamp(Math.round(10 * k), 8, 20)
  const gapHeader = clamp(Math.round(6 * k), 4, 12)
  const gapWD = clamp(Math.round(3 * k), 2, 6)
  const weekdayH = clamp(Math.round(14 * k), 12, 20)
  const headerH = clamp(Math.round(20 * k), 16, 34)
  const spacing = clamp(Math.round(2.4 * k), 2, 5)

  // 字体随尺寸提升（fit 到可用空间），小尺寸用紧凑字体。
  let titleFont: any = "caption"
  let pctFont: any = "callout"
  let wdFont: any = "caption"
  if (s >= 320) {
    titleFont = "headline"
    pctFont = "title2"
    wdFont = "footnote"
  } else if (s >= 220) {
    titleFont = "subheadline"
    pctFont = "title3"
    wdFont = "footnote"
  }

  return { pad, gapHeader, gapWD, headerH, weekdayH, titleFont, pctFont, wdFont, spacing }
}

// 返回在给定列数下、能同时满足宽高约束的最大整数点径；放不下则返回 0。
// 注意：不能用“按宽度撑满”做兜底，否则会掩盖高度溢出，导致底部行被裁。
function computeDot(
  total: number,
  cols: number,
  availW: number,
  availH: number,
  spacing: number,
): number {
  const rows = Math.ceil(total / cols)
  if (rows <= 0 || cols <= 0) return 0
  const dotW = (availW - (cols - 1) * spacing) / cols
  const dotH = (availH - (rows - 1) * spacing) / rows
  const dot = Math.floor(Math.min(dotW, dotH))
  return dot > 0 ? dot : 0
}

// 在能完整容纳所有行的前提下，选出让点径最大的列数；
// 若多个列数可达到同一最大点径，取列数最多者，使圆点铺满可用宽度（避免右侧留白）。
function bestYearCols(
  total: number,
  availW: number,
  availH: number,
  spacing: number,
): number {
  const MIN_COLS = 7
  const MAX_COLS = 40

  let maxDot = 0
  for (let c = MIN_COLS; c <= MAX_COLS; c++) {
    const dot = computeDot(total, c, availW, availH, spacing)
    if (dot > maxDot) maxDot = dot
  }

  if (maxDot > 0) {
    for (let c = MAX_COLS; c >= MIN_COLS; c--) {
      if (computeDot(total, c, availW, availH, spacing) === maxDot) return c
    }
  }

  // 极端窄小空间：连 1pt 都放不下时，退化为行数最少的方案（仍尽量避免裁剪）。
  let fallback = { cols: MAX_COLS, rows: Infinity }
  for (let c = 1; c <= 60; c++) {
    const rows = Math.ceil(total / c)
    if (rows < fallback.rows) fallback = { cols: c, rows }
  }
  return fallback.cols
}

// ---------- Rendering ----------

function renderCell(
  type: "filled" | "empty" | "blank",
  dot: number,
  active: Color,
  inactive: Color,
  key: string,
) {
  if (type === "blank") {
    return <Circle key={key} fill="clear" frame={{ width: dot, height: dot }} />
  }
  return (
    <Circle
      key={key}
      fill={type === "filled" ? active : inactive}
      frame={{ width: dot, height: dot }}
    />
  )
}

export interface ContentProps {
  config: Config
  size: Size
  family: Family
  scheme: Scheme
  mode: Mode
  weekStartsOn: 0 | 1
  inWidget: boolean
}

export function DaysDotsContent(props: ContentProps) {
  const { config, size, family, scheme, mode, weekStartsOn, inWidget } = props
  const data = computeData(mode, weekStartsOn)
  const m = metrics(size)

  const isSmall = size.width < 200
  const availW = size.width - 2 * m.pad
  const availH =
    size.height -
    2 * m.pad -
    m.headerH -
    (mode === "month" ? m.weekdayH + m.gapWD : 0) -
    m.gapHeader

  const cols = mode === "month" ? 7 : bestYearCols(data.total, availW, availH, m.spacing)
  const dot = computeDot(data.total, cols, availW, availH, m.spacing)

  const active = scheme === "dark" ? config.active.dark : config.active.light
  const inactive = scheme === "dark" ? config.inactive.dark : config.inactive.light

  const bgModifier = inWidget
    ? { widgetBackground: { light: config.background.light, dark: config.background.dark } }
    : { background: scheme === "dark" ? config.background.dark : config.background.light }

  const pct = Math.round((data.elapsed / data.total) * 100)

  const header = (
    <HStack alignment="center" spacing={6}>
      <VStack alignment="leading" spacing={2}>
        <Text font={m.titleFont} fontWeight="semibold" foregroundStyle="label">
          {data.title}
        </Text>
        {!isSmall && config.showPercent ? (
          <Text font="caption" foregroundStyle="secondaryLabel">
            {data.remaining} days left
          </Text>
        ) : null}
      </VStack>
      <Spacer />
      {config.showPercent ? (
        <Text font={m.pctFont} fontWeight="bold" foregroundStyle={active}>
          {pct}%
        </Text>
      ) : null}
    </HStack>
  )

  let grid: any
  if (mode === "month") {
    const wd =
      weekStartsOn === 0
        ? ["S", "M", "T", "W", "T", "F", "S"]
        : ["M", "T", "W", "T", "F", "S", "S"]
    const weekdayHeader = (
      <HStack alignment="center" spacing={m.spacing} frame={{ maxWidth: "infinity" }}>
        {wd.map((l, i) => (
          <Text
            key={i}
            font={m.wdFont}
            foregroundStyle="tertiaryLabel"
            frame={{ width: dot }}
          >
            {l}
          </Text>
        ))}
      </HStack>
    )

    const numRows = Math.ceil(data.cells.length / 7)
    grid = (
      <Grid horizontalSpacing={m.spacing} verticalSpacing={m.spacing}>
        {Array.from({ length: numRows }).map((_, r) => {
          const rowCells = data.cells.slice(r * 7, (r + 1) * 7)
          return (
            <GridRow key={r}>
              {rowCells.map((t, c) =>
                renderCell(t, dot, active, inactive, `${r}-${c}`),
              )}
            </GridRow>
          )
        })}
      </Grid>
    )

    return (
      <VStack
        {...bgModifier}
        frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
        padding={m.pad}
        spacing={0}
        alignment="leading"
      >
        {header}
        <Spacer />
        <VStack alignment="center" spacing={m.gapWD} frame={{ maxWidth: "infinity" }}>
          {weekdayHeader}
          {grid}
        </VStack>
        <Spacer />
      </VStack>
    )
  }

  // year
  const rows = Math.ceil(data.total / cols)
  grid = (
    <Grid horizontalSpacing={m.spacing} verticalSpacing={m.spacing}>
      {Array.from({ length: rows }).map((_, r) => {
        const cells: any[] = []
        for (let c = 0; c < cols; c++) {
          const idx = r * cols + c
          const t: "filled" | "empty" | "blank" =
            idx < data.total ? data.cells[idx] : "blank"
          cells.push(renderCell(t, dot, active, inactive, `${r}-${c}`))
        }
        return <GridRow key={r}>{cells}</GridRow>
      })}
    </Grid>
  )

  return (
    <VStack
      {...bgModifier}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
      padding={m.pad}
      spacing={0}
      alignment="leading"
    >
      {header}
      <Spacer />
      <VStack alignment="center" frame={{ maxWidth: "infinity" }}>
        {grid}
      </VStack>
      <Spacer />
    </VStack>
  )
}
