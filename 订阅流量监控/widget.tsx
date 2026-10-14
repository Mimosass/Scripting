import {
  Widget,
  VStack,
  HStack,
  ZStack,
  Text,
  Spacer,
  Image,
  Rectangle,
  Circle,
  Script,
} from "scripting"
import {
  loadConfig,
  loadAll,
  schemeOf,
  colorOf,
  textColor,
  dimColor,
  bgGradient,
  C,
  titleOf,
  statusOf,
  subLine,
  pctLeft,
  fmtBytes,
  splitBytes,
  fmtTime,
  fmtDate,
  dailyBudget,
  forecast,
  nextReset,
  daysUntil,
  Rings,
  Bar,
  Spark,
  Week,
  Gauge,
  type SubResult,
  type Scheme,
  type Traffic,
  type AppConfig,
} from "./shared"

// 圆角常量（IPA 风格）
const CARD_RADIUS = 18
const TAG_RADIUS = "buttonBorder"

const fontTitle = { font: "body" as const, fontWeight: "semibold" as const }
const fontCaption = { font: "footnote" as const, fontWeight: "regular" as const }
const fontSub = { font: "subheadline" as const, fontWeight: "semibold" as const }

function Glass({ children, extra }: { children: any; extra?: any }) {
  const merged = {
    background: { light: "rgba(255,255,255,0.5)", dark: "rgba(28,28,38,0.4)" } as any,
    cornerRadius: CARD_RADIUS,
    frame: { maxWidth: "infinity" },
    ...(extra || {}),
  }
  return (
    <VStack alignment="leading" spacing={6} padding={12} {...merged}>
      {children}
    </VStack>
  )
}

function Dot({ color, size = 6 }: { color: string; size?: number }) {
  return <Circle fill={color as any} frame={{ width: size, height: size }} />
}

function Icon({ name, color, size = 12 }: { name: string; color: string; size?: number }) {
  return (
    <Image
      systemName={name}
      foregroundStyle={color as any}
      frame={{ width: size, height: size }}
    />
  )
}

function Divider() {
  return (
    <Rectangle
      fill={{ light: "systemGray3", dark: "systemGray2" }}
      frame={{ height: 0.8, maxWidth: "infinity" }}
      opacity={0.7}
    />
  )
}

function lastUpdated(list: SubResult[]): string {
  const ts = Math.max(0, ...list.map(s => s.updatedAt || 0))
  return ts ? fmtTime(ts) : "--"
}

function Header({ list, title }: { list: SubResult[]; title: string }) {
  const bad = list.filter(x => statusOf(x).color !== C.ok).length
  return (
    <HStack alignment="center" spacing={5}>
      <Icon name="chart.pie.fill" color={C.accent} size={13} />
      <Text {...fontSub} foregroundStyle={textColor(schemeOf())}>
        {title}
      </Text>
      <Spacer />
      {bad ? <Dot color={C.warn} size={6} /> : null}
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
        {`更新 ${lastUpdated(list)}`}
      </Text>
    </HStack>
  )
}

function BigRemain({ t, size }: { t: { remaining: number }; size: number }) {
  const b = splitBytes(t.remaining)
  return (
    <HStack alignment="lastTextBaseline" spacing={2}>
      <Text font={size} fontWeight="bold" foregroundStyle={textColor(schemeOf())}>
        {b.n}
      </Text>
      <Text font={Math.round(size * 0.45)} fontWeight="semibold" foregroundStyle={dimColor(schemeOf())}>
        {b.u}
      </Text>
    </HStack>
  )
}

function StatusDot({ s }: { s: SubResult }) {
  const st = statusOf(s)
  return <Dot color={st.color === C.ok ? colorOf(0) : st.color} size={6} />
}

function SubRow({ s, i, barW, opts = {} }: { s: SubResult; i: number; barW: number; opts?: any }) {
  const color = colorOf(i)
  const st = statusOf(s)
  if (!s.traffic) {
    return (
      <VStack alignment="leading" spacing={4}>
        <HStack alignment="center" spacing={5}>
          <Dot color={color} />
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
            {s.name}
          </Text>
          <Spacer />
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={st.color as any}>
            {s.nodeCount && s.nodeCount > 0 ? `${s.nodeCount} 节点` : st.label}
          </Text>
        </HStack>
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
          {s.nodeCount && s.nodeCount > 0 ? `${s.nodeCount} 节点 · 未提供流量信息` : s.error || "读取失败"}
        </Text>
      </VStack>
    )
  }
  const t = s.traffic
  const p = pctLeft(t)
  return (
    <VStack alignment="leading" spacing={4}>
      <HStack alignment="center" spacing={5}>
        <StatusDot s={s} />
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
          {s.name}
        </Text>
        <Spacer />
        <Text font={opts.valueSize || 14} fontWeight="bold" foregroundStyle={textColor(schemeOf())}>
          {fmtBytes(t.remaining)}
        </Text>
        {p != null ? (
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={color as any}>
            {` ${Math.round(p * 100)}%`}
          </Text>
        ) : null}
      </HStack>
      <Bar pct={p == null ? 1 : p} color={color} height={opts.barH || 4} />
      {opts.detailText ? (
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())} minScaleFactor={0.8}>
          {opts.detailText(s)}
        </Text>
      ) : null}
      {opts.detail ? (
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
          {`${subLine(s)}${s.today != null ? ` · 今日 ${fmtBytes(s.today)}` : ""}`}
        </Text>
      ) : null}
    </VStack>
  )
}

function refreshDate(config: AppConfig): Date {
  const v = Number(config.refreshHours)
  const h = Number.isFinite(v) ? Math.min(24, Math.max(0.5, v)) : 2
  return new Date(Date.now() + h * 3600000)
}

function EmptyState({ message, sub }: { message: string; sub: string }) {
  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={20}
      background={bgGradient(schemeOf())}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <HStack alignment="center" spacing={5}>
        <Icon name="chart.pie.fill" color={C.accent} size={13} />
        <Text {...fontSub} foregroundStyle={textColor(schemeOf())}>
          订阅流量
        </Text>
      </HStack>
      <Spacer />
      <Icon name="link.badge.plus" color={dimColor(schemeOf())} size={22} />
      <Text {...fontTitle} foregroundStyle={textColor(schemeOf())}>
        {message}
      </Text>
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())} lineLimit={3}>
        {sub}
      </Text>
      <Spacer />
    </VStack>
  )
}

// -------------------- 单订阅 --------------------

function SingleSmall({ s }: { s: SubResult }) {
  const t = s.traffic!
  const p = pctLeft(t)
  return (
    <VStack
      alignment="leading"
      spacing={6}
      padding={20}
      background={bgGradient(schemeOf())}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <HStack alignment="center" spacing={5}>
        <Icon name="chart.pie.fill" color={C.accent} size={12} />
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
          {s.name}
        </Text>
        <Spacer />
        <StatusDot s={s} />
      </HStack>
      <Spacer />
      <HStack alignment="center" spacing={8}>
        <VStack alignment="leading" spacing={0}>
          <Text {...fontCaption} fontWeight="medium" foregroundStyle={dimColor(schemeOf())}>
            剩余流量
          </Text>
          <BigRemain t={t} size={20} />
        </VStack>
        <Spacer />
        <Rings values={[{ pct: p == null ? 1 : p, color: C.accent }]} size={84} stroke={12} gap={0} />
      </HStack>
      <Spacer />
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
        {subLine(s)}
      </Text>
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
        {s.today != null ? `今日已用 ${fmtBytes(s.today)}` : `更新 ${fmtTime(s.updatedAt)}`}
      </Text>
    </VStack>
  )
}

function SingleMedium({ s }: { s: SubResult }) {
  const t = s.traffic!
  const p = pctLeft(t)
  const daily = dailyBudget(s)
  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={20}
      background={bgGradient(schemeOf())}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <Header list={[s]} title={s.name} />
      <HStack alignment="center" spacing={12}>
        <VStack alignment="center" spacing={2}>
          <Rings values={[{ pct: p == null ? 1 : p, color: C.accent }]} size={88} stroke={13} gap={0} />
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={C.accent as any}>
            {p == null ? (t.unlimited ? "不限量" : "--") : `剩 ${Math.round(p * 100)}%`}
          </Text>
        </VStack>
        <Glass
          extra={{
            spacing: 4,
          }}
        >
          <Text {...fontCaption} fontWeight="medium" foregroundStyle={dimColor(schemeOf())}>
            剩余流量
          </Text>
          <BigRemain t={t} size={26} />
          <HStack spacing={8}>
            <VStack alignment="leading" spacing={1}>
              <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
                已用
              </Text>
              <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
                {fmtBytes(t.used ?? 0)}
              </Text>
            </VStack>
            <VStack alignment="leading" spacing={1}>
              <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
                总量
              </Text>
              <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
                {t.unlimited ? "不限量" : fmtBytes(t.total ?? 0)}
              </Text>
            </VStack>
            <VStack alignment="leading" spacing={1}>
              <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
                日均可用
              </Text>
              <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
                {daily == null ? "--" : fmtBytes(daily)}
              </Text>
            </VStack>
          </HStack>
          <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
            {`${subLine(s)}${s.today != null ? ` · 今日 ${fmtBytes(s.today)}` : ""}`}
          </Text>
        </Glass>
      </HStack>
    </VStack>
  )
}

function SingleLarge({ s }: { s: SubResult }) {
  const t = s.traffic!
  const p = pctLeft(t)
  const daily = dailyBudget(s)
  const r = nextReset(s.resetDay)
  const cell = (k: string, v: string, c?: string) => (
    <Glass
      extra={{
        spacing: 3,
      }}
    >
      <Text {...fontCaption} fontWeight="medium" foregroundStyle={dimColor(schemeOf())}>
        {k}
      </Text>
      <Text font={15} fontWeight="bold" foregroundStyle={(c || textColor(schemeOf())) as any}>
        {v}
      </Text>
    </Glass>
  )
  return (
    <VStack
      alignment="leading"
      spacing={10}
      padding={20}
      background={bgGradient(schemeOf())}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <Header list={[s]} title={s.name} />
      <HStack alignment="center" spacing={14}>
        <Rings values={[{ pct: p == null ? 1 : p, color: C.accent }]} size={120} stroke={16} gap={0} />
        <VStack alignment="leading" spacing={2}>
          <Text {...fontCaption} fontWeight="medium" foregroundStyle={dimColor(schemeOf())}>
            剩余流量
          </Text>
          <BigRemain t={t} size={34} />
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={C.accent as any}>
            {p == null ? "" : `剩余 ${Math.round(p * 100)}% · 状态 ${statusOf(s).label}`}
          </Text>
        </VStack>
        <Spacer />
      </HStack>
      <Bar pct={p == null ? 1 : p} color={C.accent} height={6} />
      <HStack spacing={8}>
        {cell("下载", Number.isFinite(t.download as number) ? fmtBytes(t.download as number) : "--")}
        {cell("上传", Number.isFinite(t.upload as number) ? fmtBytes(t.upload as number) : "--")}
        {cell("今日已用", s.today == null ? "--" : fmtBytes(s.today))}
      </HStack>
      <HStack spacing={8}>
        {cell("套餐总量", t.unlimited ? "不限量" : fmtBytes(t.total ?? 0))}
        {cell("日均可用", daily == null ? "--" : fmtBytes(daily), C.ok)}
        {cell("节点", s.nodeCount && s.nodeCount > 0 ? `${s.nodeCount} 个` : "--")}
      </HStack>
      <HStack spacing={8}>
        {cell("套餐到期", fmtDate(t.expireAt))}
        {cell("流量重置", r ? (r.days === 0 ? "今日" : `${r.days} 天后`) : "--", C.accent)}
      </HStack>
      <Spacer />
    </VStack>
  )
}

// -------------------- 多订阅 --------------------

function multiSummary(list: SubResult[]) {
  const withT = list.filter(s => s.traffic && !s.traffic.unlimited && Number.isFinite(s.traffic.remaining))
  const sumRemain = withT.reduce((a, s) => a + (s.traffic!.remaining as number), 0)
  const sumToday = list.reduce((a, s) => a + (s.today || 0), 0)
  const nodes = list.reduce((a, s) => a + (s.nodeCount || 0), 0)
  return { sumRemain, sumToday, nodes }
}

function MultiSmall({ list, config }: { list: SubResult[]; config: AppConfig }) {
  const shown = list.slice(0, 4)
  const n = shown.length
  const { sumRemain, sumToday } = multiSummary(shown)
  return (
    <VStack
      alignment="leading"
      spacing={6}
      padding={20}
      background={bgGradient(schemeOf())}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <HStack alignment="center" spacing={5}>
        <Icon name="chart.pie.fill" color={C.accent} size={12} />
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
          {titleOf(list, config)}
        </Text>
        <Spacer />
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
          {lastUpdated(list).slice(-5)}
        </Text>
      </HStack>
      <Spacer />
      <HStack alignment="center" spacing={10}>
        <Rings
          values={shown.map((s, i) => ({ pct: s.traffic ? (pctLeft(s.traffic) ?? 1) : 0, color: colorOf(i) }))}
          size={76}
          stroke={15}
          gap={3}
        />
        <VStack alignment="leading" spacing={1}>
          <Text {...fontCaption} fontWeight="medium" foregroundStyle={dimColor(schemeOf())}>
            合计剩余
          </Text>
          <BigRemain t={{ remaining: sumRemain }} size={18} />
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={C.accent as any}>
            {`今日 ${fmtBytes(sumToday)}`}
          </Text>
        </VStack>
      </HStack>
      <Spacer />
    </VStack>
  )
}

function MultiMedium({ list, config }: { list: SubResult[]; config: AppConfig }) {
  const shown = list.slice(0, 4)
  const n = shown.length
  const { sumRemain, sumToday } = multiSummary(shown)
  const ringStroke = n >= 4 ? 10 : 12
  const valueSize = n >= 4 ? 12 : n === 3 ? 13 : 14
  const barH = n >= 4 ? 3 : 4
  const detailText =
    n <= 2
      ? (s: SubResult) => {
          const parts = [`今日 ${s.today == null ? "--" : fmtBytes(s.today)}`]
          const d = dailyBudget(s)
          if (d != null) parts.push(`日均 ${fmtBytes(d)}`)
          const r = nextReset(s.resetDay)
          const e = s.traffic ? daysUntil(s.traffic.expireAt) : null
          if (r) parts.push(r.days === 0 ? "今日重置" : `重置 ${r.days} 天`)
          else if (e != null) parts.push(`到期 ${Math.max(0, e)} 天`)
          return parts.join(" · ")
        }
      : null
  return (
    <VStack
      alignment="leading"
      spacing={6}
      padding={{ horizontal: 20, vertical: 14 }}
      background={bgGradient(schemeOf())}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <Header list={list} title={titleOf(list, config)} />
      <HStack alignment="center" spacing={12}>
        <VStack alignment="center" spacing={3}>
          <Rings
            values={shown.map((s, i) => ({ pct: s.traffic ? (pctLeft(s.traffic) ?? 1) : 0, color: colorOf(i) }))}
            size={84}
            stroke={ringStroke}
            gap={3}
          />
          <HStack alignment="lastTextBaseline" spacing={1}>
            <Text font={15} fontWeight="bold" foregroundStyle={textColor(schemeOf())} minScaleFactor={0.8}>
              {splitBytes(sumRemain).n}
            </Text>
            <Text {...fontCaption} fontWeight="semibold" foregroundStyle={dimColor(schemeOf())}>
              {splitBytes(sumRemain).u}
            </Text>
          </HStack>
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={C.accent as any}>
            {`今日 ${fmtBytes(sumToday)}`}
          </Text>
        </VStack>
        <Glass
          extra={{
            spacing: n >= 4 ? 4 : n === 3 ? 6 : 8,
          }}
        >
          {shown.map((s, i) => (
            <SubRow s={s} i={i} barW={190} opts={{ valueSize, barH, detailText }} key={i} />
          ))}
        </Glass>
      </HStack>
    </VStack>
  )
}

function WeekCard({ shown, height }: { shown: SubResult[]; height: number }) {
  const now = new Date()
  const wk = ["日", "一", "二", "三", "四", "五", "六"]
  const labels: string[] = []
  for (let i = 6; i >= 0; i--) labels.push(i === 0 ? "今" : wk[new Date(now.getTime() - i * 86400000).getDay()])
  const legend = shown.map((s, i) => (
    <HStack alignment="center" spacing={3} key={i}>
      <Dot color={colorOf(i)} size={6} />
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
        {s.name}
      </Text>
    </HStack>
  ))
  const week = shown.reduce<number>((a, s) => a + (s.hist || []).reduce<number>((x, v) => x + (v || 0), 0), 0)
  return (
    <Glass
      extra={{
        spacing: 4,
      }}
    >
      <HStack alignment="center" spacing={6}>
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
          近 7 天用量
        </Text>
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={C.accent as any}>
          {`共 ${fmtBytes(week)}`}
        </Text>
        <Spacer />
        {legend}
      </HStack>
      <Spacer />
      <Week list={shown} height={Math.max(30, height - 58)} />
      <HStack spacing={0}>
        {labels.map((l, i) => (
          <HStack key={i} alignment="center" frame={{ width: `${100 / 7}%` as any }}>
            <Spacer />
            <Text
              {...fontCaption}
              fontWeight={i === 6 ? "semibold" : "medium"}
              foregroundStyle={(i === 6 ? textColor(schemeOf()) : dimColor(schemeOf())) as any}
            >
              {l}
            </Text>
            <Spacer />
          </HStack>
        ))}
      </HStack>
    </Glass>
  )
}

function DetailCard({ s, i, o = {} }: { s: SubResult; i: number; o?: any }) {
  const F = { name: o.name || 11, big: o.big || 19, small: o.small || 9 }
  const color = colorOf(i)
  const st = statusOf(s)
  const head = (
    <HStack alignment="center" spacing={4}>
      <Dot color={st.color === C.ok ? color : st.color} size={6} />
      <Text font={F.name} fontWeight="semibold" foregroundStyle={textColor(schemeOf())} minScaleFactor={1}>
        {s.name}
      </Text>
      <Spacer />
      {st.color !== C.ok && s.traffic ? (
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={st.color as any}>
          {st.label}
        </Text>
      ) : (
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
          {s.nodeCount && s.nodeCount > 0 ? `${s.nodeCount} 节点` : "-- 节点"}
        </Text>
      )}
    </HStack>
  )
  if (!s.traffic) {
    return (
      <Glass
        extra={{
          height: o.height,
          spacing: 2,
        }}
      >
        {head}
        <Spacer />
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={dimColor(schemeOf())}>
          读取失败
        </Text>
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
          {s.error || "稍后自动重试"}
        </Text>
        <Spacer />
      </Glass>
    )
  }
  const t = s.traffic
  const p = pctLeft(t)
  const daily = dailyBudget(s)
  const e = daysUntil(t.expireAt)
  const r = nextReset(s.resetDay)
  const b = splitBytes(t.remaining)
  const fc = forecast(s)
  return (
    <Glass
      extra={{
        glassEffect: "auto",
        shape: { type: "rect", cornerRadius: CARD_RADIUS },
        height: o.height,
        spacing: 2,
      }}
    >
      {head}
      <HStack alignment="lastTextBaseline" spacing={4}>
        <VStack alignment="leading" spacing={0}>
          <HStack alignment="lastTextBaseline" spacing={2}>
            <Text font={F.big} fontWeight="bold" foregroundStyle={textColor(schemeOf())} minScaleFactor={1}>
              {b.n}
            </Text>
            <Text {...fontCaption} fontWeight="semibold" foregroundStyle={dimColor(schemeOf())}>
              {b.u}
            </Text>
          </HStack>
          <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())} minScaleFactor={0.7}>
            {`已用 ${fmtBytes(t.used ?? 0)} / ${t.unlimited ? "∞" : fmtBytes(t.total ?? 0)}`}
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="center" spacing={-4}>
          <Gauge pct={p == null ? 1 : p} color={color} width={64} />
          <Text {...fontCaption} fontWeight="bold" foregroundStyle={color as any}>
            {p == null ? "∞" : `${Math.round(p * 100)}%`}
          </Text>
        </VStack>
      </HStack>
      <HStack alignment="lastTextBaseline" spacing={5}>
        <Spark values={s.hist || [null, null, null, null, null, null, s.today ?? null]} color={color} width={70} height={14} />
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
          {`今日 ${s.today == null ? "--" : fmtBytes(s.today)}`}
        </Text>
      </HStack>
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
        {`日均可用 ${daily == null ? "--" : fmtBytes(daily)}`}
      </Text>
      <Text {...fontCaption} fontWeight="semibold" foregroundStyle={fc.color as any}>
        {fc.text}
      </Text>
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
        {`${e == null ? "长期有效" : `到期 ${Math.max(0, e)} 天`} · ${r ? (r.days === 0 ? "今日重置" : `重置 ${r.days} 天`) : "不重置"}`}
      </Text>
    </Glass>
  )
}

function CompactCard({ s, i }: { s: SubResult; i: number }) {
  const color = colorOf(i)
  const st = statusOf(s)
  const head = (
    <HStack alignment="center" spacing={3}>
      <Dot color={st.color === C.ok ? color : st.color} size={6} />
      <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())} minScaleFactor={0.8}>
        {s.name}
      </Text>
    </HStack>
  )
  if (!s.traffic) {
    return (
      <Glass
        extra={{
          glassEffect: "auto",
          shape: { type: "rect", cornerRadius: CARD_RADIUS },
          height: 108,
          spacing: 2,
        }}
      >
        {head}
        <Spacer />
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={dimColor(schemeOf())}>
          读取失败
        </Text>
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
          {s.error || "稍后重试"}
        </Text>
        <Spacer />
      </Glass>
    )
  }
  const t = s.traffic
  const p = pctLeft(t)
  const b = splitBytes(t.remaining)
  const fc = forecast(s)
  const e = daysUntil(t.expireAt)
  const r = nextReset(s.resetDay)
  return (
    <Glass
      extra={{
        height: 108,
        spacing: 2,
      }}
    >
      {head}
      <HStack alignment="lastTextBaseline" spacing={2}>
        <Text font={17} fontWeight="bold" foregroundStyle={textColor(schemeOf())} minScaleFactor={0.7}>
          {b.n}
        </Text>
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={dimColor(schemeOf())}>
          {b.u}
        </Text>
        <Spacer />
        <Text {...fontCaption} fontWeight="bold" foregroundStyle={color as any}>
          {p == null ? "∞" : `${Math.round(p * 100)}%`}
        </Text>
      </HStack>
      <Bar pct={p == null ? 1 : p} color={color} height={4} />
      <HStack alignment="lastTextBaseline" spacing={3}>
        <Spark values={s.hist || [null, null, null, null, null, null, s.today ?? null]} color={color} width={70} height={14} />
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
          {`今日 ${s.today == null ? "--" : fmtBytes(s.today)}`}
        </Text>
      </HStack>
      <Text {...fontCaption} fontWeight="semibold" foregroundStyle={fc.color as any}>
        {fc.text}
      </Text>
      <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
        {`${e == null ? "长期" : `到期${Math.max(0, e)}天`}${r ? (r.days === 0 ? "·今日重置" : `·重置${r.days}天`) : ""}`}
      </Text>
    </Glass>
  )
}

function MultiLarge({ list, config }: { list: SubResult[]; config: AppConfig }) {
  const shown = list.slice(0, 4)
  const n = shown.length
  const { sumRemain, sumToday, nodes } = multiSummary(shown)
  const chartH = n >= 3 ? 0 : 62
  const cardSpacing = n >= 4 ? 1 : 2
  const valueSize = n >= 4 ? 13 : 15
  const barH = n >= 4 ? 3 : 4
  return (
    <VStack
      alignment="leading"
      spacing={8}
      padding={20}
      background={bgGradient(schemeOf())}
      frame={{ maxWidth: "infinity", maxHeight: "infinity" }}
    >
      <Header list={list} title={titleOf(list, config)} />
      <HStack alignment="center" spacing={12}>
        <Rings
          values={shown.map((s, i) => ({ pct: s.traffic ? (pctLeft(s.traffic) ?? 1) : 0, color: colorOf(i) }))}
          size={84}
          stroke={n >= 4 ? 9 : 11}
          gap={3}
        />
        <VStack alignment="leading" spacing={2}>
          <Text {...fontCaption} fontWeight="medium" foregroundStyle={dimColor(schemeOf())}>
            {`${n} 个订阅 · 合计剩余`}
          </Text>
          <BigRemain t={{ remaining: sumRemain }} size={22} />
          <Text {...fontCaption} fontWeight="semibold" foregroundStyle={C.accent as any}>
            {`今日已用 ${fmtBytes(sumToday)}${nodes ? ` · ${nodes} 节点` : ""}`}
          </Text>
        </VStack>
        <Spacer />
      </HStack>
      <VStack alignment="leading" spacing={cardSpacing}>
        {shown.map((s, i) => (
          <Glass
            extra={{
              padding: n >= 4 ? { horizontal: 10, vertical: 6 } : 10,
              spacing: 2,
            }}
            key={i}
          >
            <SubRow s={s} i={i} barW={290} opts={{ detail: true, valueSize, barH }} />
          </Glass>
        ))}
      </VStack>
      {chartH ? (
        <WeekCard shown={shown} height={chartH} />
      ) : (
        <Spacer />
      )}
    </VStack>
  )
}

// -------------------- 锁屏 accessory --------------------

function LockWidget({ list, family }: { list: SubResult[]; family: string }) {
  const ok = list.filter(s => s.traffic)
  if (!ok.length) {
    return (
      <VStack alignment="leading" spacing={0} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        <Text {...fontCaption} fontWeight="semibold" foregroundStyle={textColor(schemeOf())}>
          {list.length ? "订阅流量：读取失败" : "订阅流量：待配置"}
        </Text>
      </VStack>
    )
  }
  if (family === "accessoryCircular") {
    const s = ok[0]
    const p = pctLeft(s.traffic!)
    return (
      <ZStack alignment="center" frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
        <Rings values={[{ pct: p == null ? 1 : p, color: "#FFFFFF" }]} size={60} stroke={6} gap={0} />
        <VStack alignment="center" spacing={0}>
          <Text font={14} fontWeight="bold" foregroundStyle={textColor(schemeOf())}>
            {p == null ? "∞" : `${Math.round(p * 100)}%`}
          </Text>
          <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())} lineLimit={1} minScaleFactor={0.5}>
            {splitBytes(s.traffic!.remaining).n}
          </Text>
        </VStack>
      </ZStack>
    )
  }
  return (
    <VStack alignment="leading" spacing={2} frame={{ maxWidth: "infinity", maxHeight: "infinity" }}>
      {ok.slice(0, 3).map((s, i) => (
        <HStack alignment="center" spacing={4} key={i}>
          <Icon name="chart.pie.fill" color={C.accent} size={10} />
          <Text font="caption" fontWeight="semibold" foregroundStyle={textColor(schemeOf())} lineLimit={1} minScaleFactor={0.6}>
            {`${s.name} ${fmtBytes(s.traffic!.remaining)}`}
          </Text>
          <Spacer />
          {(() => {
            const e = daysUntil(s.traffic!.expireAt)
            return e == null ? null : (
              <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())}>
                {`${Math.max(0, e)}天`}
              </Text>
            )
          })()}
        </HStack>
      ))}
    </VStack>
  )
}

// -------------------- 入口 --------------------

async function buildContent(): Promise<{ element: any; date: Date } | null> {
  const config = loadConfig()
  const list = await loadAll(config)
  const family = (Widget.family as string) || "systemMedium"
  const date = refreshDate(config)

  if (family.startsWith("accessory")) {
    return { element: <LockWidget list={list} family={family} />, date }
  }

  if (!list.length) {
    return {
      element: (
        <EmptyState
          message="等待订阅地址"
          sub="打开本脚本的设置页，添加订阅链接（最多 4 个）"
        />
      ),
      date,
    }
  }

  if (list.length === 1) {
    const s = list[0]
    if (!s.traffic) {
      return {
        element: (
          <EmptyState
            message={s.nodeCount && s.nodeCount > 0 ? `${s.nodeCount} 个可用节点` : "无法读取流量"}
            sub={s.error || "订阅未提供流量信息"}
          />
        ),
        date,
      }
    }
    if (family === "systemSmall") return { element: <SingleSmall s={s} />, date }
    if (family === "systemLarge" || family.includes("ExtraLarge"))
      return { element: <SingleLarge s={s} />, date }
    return { element: <SingleMedium s={s} />, date }
  }

  if (family === "systemSmall") return { element: <MultiSmall list={list} config={config} />, date }
  if (family === "systemLarge" || family.includes("ExtraLarge"))
    return { element: <MultiLarge list={list} config={config} />, date }
  return { element: <MultiMedium list={list} config={config} />, date }
}

async function main() {
  try {
    const result = await buildContent()
    if (result) {
      Widget.present(result.element, { policy: "after", date: result.date })
    }
  } catch (e) {
    Widget.present(
      <VStack alignment="leading" spacing={6} padding={20} background={bgGradient(schemeOf())}>
        <Text {...fontSub} foregroundStyle={C.fail as any}>
          组件出错
        </Text>
        <Text {...fontCaption} foregroundStyle={dimColor(schemeOf())} lineLimit={5}>
          {String((e as any)?.message || e)}
        </Text>
      </VStack>,
      { policy: "after", date: new Date(Date.now() + 3600000) },
    )
  }
  Script.exit()
}

main()
