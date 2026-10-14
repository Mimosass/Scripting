import { Canvas, type CanvasRenderingContext, type CanvasSize, type Color, type LinearGradient, Device } from "scripting"

declare function fetch(url: string, init?: any): Promise<any>

// ---------------------------------------------------------------------------
// 配置
// ---------------------------------------------------------------------------

export interface SubConfig {
  url: string
  name: string
  resetDay: string
  planGB: string
}

export interface AppConfig {
  subs: SubConfig[]
  title: string
  refreshHours: number
  userAgent: string
}

export const STORAGE_KEY = "subTrafficConfig"

export const DEFAULT_CONFIG: AppConfig = {
  subs: [],
  title: "",
  refreshHours: 2,
  userAgent: "",
}

export function loadConfig(): AppConfig {
  try {
    const stored = Storage.get(STORAGE_KEY) as Partial<AppConfig> | null
    if (stored && Array.isArray(stored.subs)) {
      return {
        subs: stored.subs.map(s => ({
          url: String(s.url || "").trim(),
          name: String(s.name || "").trim(),
          resetDay: String(s.resetDay || "").trim(),
          planGB: String(s.planGB || "").trim(),
        })),
        title: String(stored.title || "").trim(),
        refreshHours: Number.isFinite(Number(stored.refreshHours)) ? Number(stored.refreshHours) : 2,
        userAgent: String(stored.userAgent || "").trim(),
      }
    }
  } catch {
    /* ignore */
  }
  return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
}

export function saveConfig(config: AppConfig): void {
  try {
    Storage.set(STORAGE_KEY, config)
  } catch {
    /* ignore */
  }
}

export function schemeOf(): "light" | "dark" {
  return Device.colorScheme === "dark" ? "dark" : "light"
}

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface Traffic {
  upload: number | null
  download: number | null
  total: number | null
  used: number | null
  remaining: number
  unlimited: boolean
  expireAt: number
  partial?: boolean
  totalEstimated?: boolean
  source?: string
}

export type SubMode = "live" | "nodesOnly" | "stale" | "error"

export interface SubResult extends SubConfig {
  mode: SubMode
  traffic?: Traffic
  nodeCount?: number
  updatedAt?: number
  error?: string
  today?: number | null
  hist?: (number | null)[]
}

// ---------------------------------------------------------------------------
// 视觉常量
// ---------------------------------------------------------------------------

export const PALETTE = ["#BF5AF2", "#0A84FF", "#30D158", "#FF9F0A"]
export const C = {
  accent: "#BF5AF2",
  ok: "#30D158",
  warn: "#FF9F0A",
  fail: "#FF453A",
}
export type Scheme = "light" | "dark"

export function colorOf(i: number): string {
  return PALETTE[i % PALETTE.length]
}

export function textColor(_s: Scheme): Color {
  return "label"
}

export function dimColor(_s: Scheme): Color {
  return "secondaryLabel"
}

export function dim2Color(_s: Scheme): Color {
  return "tertiaryLabel"
}

export function tintedGlass(s: Scheme) {
  return UIGlass.clear().interactive(true)
}

export function bgGradient(s: Scheme): LinearGradient {
  // IPA 风格的深浅渐变底，配合 Liquid Glass 卡片
  return {
    gradient:
      s === "dark"
        ? [
            { color: "#1A0F33", location: 0 },
            { color: "#0B1530", location: 0.55 },
            { color: "#06120E", location: 1 },
          ]
        : [
            { color: "#F3EEFF", location: 0 },
            { color: "#EEF4FF", location: 0.55 },
            { color: "#F2FBF7", location: 1 },
          ],
    startPoint: { x: 0, y: 0 },
    endPoint: { x: 1, y: 1 },
  }
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

export function hashString(value: string): string {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) hash = (hash << 5) + hash + value.charCodeAt(i)
  return (hash >>> 0).toString(36)
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// ---------------------------------------------------------------------------
// 流量解析
// ---------------------------------------------------------------------------

export function parseUserInfo(raw: string): Traffic | null {
  const values: Record<string, number> = {}
  String(raw || "").split(";").forEach(part => {
    const index = part.indexOf("=")
    if (index < 1) return
    const key = part.slice(0, index).trim().toLowerCase()
    const value = Number(part.slice(index + 1).trim())
    if (Number.isFinite(value)) values[key] = value
  })

  if (
    !Number.isFinite(values.upload) ||
    !Number.isFinite(values.download) ||
    !Number.isFinite(values.total)
  ) {
    return null
  }

  const upload = Math.max(0, values.upload)
  const download = Math.max(0, values.download)
  const total = Math.max(0, values.total)
  const used = upload + download
  const unlimited = total === 0
  const remaining = unlimited ? Infinity : Math.max(0, total - used)
  const expireValue = Number(values.expire) || 0
  const expireAt = expireValue > 1000000000000 ? expireValue : expireValue * 1000

  return { upload, download, total, used, remaining, unlimited, expireAt }
}

function unitBytes(value: number, unit: string): number | null {
  const powers: Record<string, number> = { B: 0, KB: 1, MB: 2, GB: 3, TB: 4, PB: 5 }
  const power = powers[String(unit || "").toUpperCase()]
  if (power == null) return null
  return Number(value) * 1024 ** power
}

export function parseBodyInfo(body: string): Traffic | null {
  const source = String(body || "").replace(/\\u([0-9a-fA-F]{4})/g, (_, code) =>
    String.fromCharCode(parseInt(code, 16)),
  )
  const expireMatch = source.match(
    /(?:有效期|到期(?:时间)?|过期(?:时间)?)[：:\s]*([12]\d{3}[-/.]\d{1,2}[-/.]\d{1,2})/i,
  )
  const remainingMatch = source.match(
    /剩余(?:流量)?[：:\s]*([0-9]+(?:\.[0-9]+)?)\s*(PB|TB|GB|MB|KB|B)/i,
  )
  if (!remainingMatch) return null

  const remaining = unitBytes(Number(remainingMatch[1]), remainingMatch[2])
  if (!Number.isFinite(remaining)) return null

  const totalMatch = source.match(
    /(?:总(?:流量|量)|套餐流量)[：:\s]*([0-9]+(?:\.[0-9]+)?)\s*(PB|TB|GB|MB|KB|B)/i,
  )
  const usedMatch = source.match(
    /已用(?:流量)?[：:\s]*([0-9]+(?:\.[0-9]+)?)\s*(PB|TB|GB|MB|KB|B)/i,
  )
  const total = totalMatch ? unitBytes(Number(totalMatch[1]), totalMatch[2]) : null
  const explicitUsed = usedMatch ? unitBytes(Number(usedMatch[1]), usedMatch[2]) : null
  const used = Number.isFinite(explicitUsed)
    ? (explicitUsed as number)
    : Number.isFinite(total)
      ? Math.max(0, (total as number) - (remaining as number))
      : null

  let expireAt = 0
  if (expireMatch) {
    const normalized = expireMatch[1].replace(/[/.]/g, "-")
    const parsed = new Date(`${normalized}T23:59:59`)
    if (!Number.isNaN(parsed.getTime())) expireAt = parsed.getTime()
  }

  return {
    upload: null,
    download: null,
    total,
    used,
    remaining: remaining as number,
    unlimited: false,
    expireAt,
    partial: !Number.isFinite(total as number),
    source: "body",
  }
}

// ---------------------------------------------------------------------------
// 节点计数
// ---------------------------------------------------------------------------

function base64ToString(base64: string): string {
  const cleaned = String(base64).replace(/-/g, "+").replace(/_/g, "/").replace(/[^A-Za-z0-9+/=]/g, "")
  if (!cleaned) return ""
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let output = ""
  let buffer = 0
  let bits = 0
  for (let i = 0; i < cleaned.length; i += 1) {
    const char = cleaned[i]
    if (char === "=") break
    const index = alphabet.indexOf(char)
    if (index < 0) continue
    buffer = (buffer << 6) | index
    bits += 6
    if (bits >= 8) {
      bits -= 8
      output += String.fromCharCode((buffer >> bits) & 0xff)
    }
  }
  return output
}

const NODE_PROTOCOLS = [
  "vmess://", "vless://", "trojan://", "hysteria2://", "hysteria://",
  "hy2://", "tuic://", "ssr://", "ss://", "snell://", "anytls://", "wireguard://", "wg://",
  "socks5://", "socks://", "http://", "https://",
]

function countProtocolLinks(text: string): number {
  if (!text) return 0
  let total = 0
  for (const protocol of NODE_PROTOCOLS) {
    const re = protocol.startsWith("http") || protocol.startsWith("socks")
      ? new RegExp(`^\\s*${protocol}`, "gm")
      : new RegExp(`(^|[^A-Za-z])${protocol}`, "g")
    const matches = text.match(re)
    if (matches) total += matches.length
  }
  return total
}

function countClashProxies(text: string): number {
  const flow = text.match(/^proxies:\s*\[([\s\S]*?)\]\s*$/m)
  if (flow) {
    const m = flow[1].match(/name:/g)
    return m ? m.length : 0
  }
  const startMatch = text.match(/^proxies:[ \t]*(#.*)?$/m)
  if (!startMatch) return 0
  const rest = text.slice(startMatch.index! + startMatch[0].length)
  const endMatch = rest.match(/\n[^\s#\-][^\n]*:/)
  const section = endMatch ? rest.slice(0, endMatch.index!) : rest
  const nameMatches = section.match(/(^|\n)\s*-\s*(\{\s*)?['"]?name['"]?\s*:/g)
  return nameMatches ? nameMatches.length : 0
}

function countSurgeLike(text: string): number {
  let n = 0
  const surge = text.match(
    /^\s*[^#;\n=]+=\s*(ss|ssr|vmess|vless|trojan|snell|tuic|hysteria2?|wireguard|anytls|socks5(-tls)?|https?)\s*,/gim,
  )
  if (surge) n += surge.length
  const qx = text.match(/^\s*(shadowsocks|vmess|vless|trojan|http|socks5)\s*=\s*[^,\n]+,/gim)
  if (qx) n += qx.length
  return n
}

export function countNodes(bodyText: string): number {
  if (!bodyText) return 0
  const raw = String(bodyText)

  const direct = countProtocolLinks(raw)
  if (direct > 0) return direct

  const clash = countClashProxies(raw)
  if (clash > 0) return clash

  const surge = countSurgeLike(raw)
  if (surge > 0) return surge

  const trimmed = raw.trim()
  if (trimmed.length > 20 && /^[A-Za-z0-9+/=_\-\s]+$/.test(trimmed)) {
    const decoded = base64ToString(trimmed)
    const decodedCount = countProtocolLinks(decoded) || countSurgeLike(decoded)
    if (decodedCount > 0) return decodedCount
  }

  return 0
}

// ---------------------------------------------------------------------------
// 取订阅（多 UA 轮试）
// ---------------------------------------------------------------------------

export function normalizeSubUrl(raw: string): string {
  const url = String(raw || "").trim()
  if (/^https?:\/\//i.test(url)) return url
  try {
    const decoded = decodeURIComponent(url)
    if (/^https?:\/\//i.test(decoded)) return decoded
  } catch {
    /* 不是合法百分号编码，回退原串 */
  }
  return url
}

async function fetchSubscription(
  url: string,
  customUA: string,
): Promise<{ traffic: Traffic | null; nodeCount: number }> {
  const realUrl = normalizeSubUrl(url)
  const userAgents = Array.from(
    new Set(
      [customUA, "clash.meta", "clash-verge/v2.2.3", "v2rayN/6.42", "Surge/5.0", "Quantumult%20X/1.5.0"].filter(
        Boolean,
      ) as string[],
    ),
  )

  const extract = async (response: any) => {
    const headerData = parseUserInfo(response?.headers?.get?.("subscription-userinfo") || "")
    let bodyText = ""
    try {
      bodyText = await response.text()
    } catch {
      bodyText = ""
    }
    return {
      traffic: headerData || parseBodyInfo(bodyText),
      nodeCount: countNodes(bodyText),
    }
  }

  let bestNodeCount = 0
  let foundTraffic: Traffic | null = null
  let succeeded = false

  for (const userAgent of userAgents) {
    try {
      const response = await fetch(realUrl, {
        headers: { "User-Agent": userAgent },
        timeout: 8,
      })
      succeeded = true

      if (foundTraffic && bestNodeCount > 0) break
      const direct = await extract(response)
      bestNodeCount = Math.max(bestNodeCount, direct.nodeCount)
      if (direct.traffic && !foundTraffic) foundTraffic = direct.traffic
      if (foundTraffic && bestNodeCount > 0) return { traffic: foundTraffic, nodeCount: bestNodeCount }
      if (foundTraffic) continue
    } catch {
      /* 尝试下一个常见客户端 UA */
    }
  }

  if (!succeeded) throw new Error("订阅请求失败，请检查链接或网络")
  return { traffic: foundTraffic, nodeCount: bestNodeCount }
}

function applyPlanTotal(sub: SubConfig, traffic: Traffic | null): Traffic | null {
  if (!traffic) return traffic
  const planGB = sub.planGB ? Number(sub.planGB) : 100
  if (Number.isFinite(traffic.total as number) || !Number.isFinite(planGB) || planGB <= 0)
    return traffic
  const total = planGB * 1024 ** 3
  return {
    ...traffic,
    total,
    used: Math.max(0, total - traffic.remaining),
    partial: false,
    totalEstimated: true,
  }
}

function todayUsed(key: string, traffic: Traffic): number | null {
  if (!traffic || traffic.unlimited || !Number.isFinite(traffic.remaining)) return null
  const k = `${key}.day`
  const today = dayKey(new Date())
  let snap: { date: string; start: number } | null = null
  try {
    snap = Storage.get(k) as any
  } catch {
    /* ignore */
  }
  if (!snap || snap.date !== today || traffic.remaining > snap.start + 1048576) {
    snap = { date: today, start: traffic.remaining }
    try {
      Storage.set(k, snap)
    } catch {
      /* ignore */
    }
  }
  const used = Math.max(0, snap.start - traffic.remaining)
  const hk = `${key}.hist`
  let hist: Record<string, number> = {}
  try {
    hist = (Storage.get(hk) as any) || {}
  } catch {
    /* ignore */
  }
  hist[today] = used
  const keep: Record<string, number> = {}
  for (let i = 0; i < 8; i++) {
    const d = dayKey(new Date(Date.now() - i * 86400000))
    if (hist[d] != null) keep[d] = hist[d]
  }
  try {
    Storage.set(hk, keep)
  } catch {
    /* ignore */
  }
  return used
}

function readHist(key: string): (number | null)[] {
  let hist: Record<string, number> = {}
  try {
    hist = (Storage.get(`${key}.hist`) as any) || {}
  } catch {
    /* ignore */
  }
  const arr: (number | null)[] = []
  for (let i = 6; i >= 0; i--) {
    const d = dayKey(new Date(Date.now() - i * 86400000))
    arr.push(hist[d] == null ? null : hist[d])
  }
  return arr
}

export async function loadOne(sub: SubConfig, globalUA: string): Promise<SubResult> {
  const key = `subTraffic.cache.${hashString(sub.url)}`
  try {
    const fetched = await fetchSubscription(sub.url, globalUA)
    let prev: any = null
    try {
      prev = (Storage.get(key) as any) || null
    } catch {
      /* ignore */
    }
    if (!(fetched.nodeCount > 0) && prev?.nodeCount > 0) fetched.nodeCount = prev.nodeCount
    if (fetched.traffic) {
      const traffic = applyPlanTotal(sub, fetched.traffic)!
      const result: SubResult = {
        ...sub,
        mode: "live",
        traffic,
        nodeCount: fetched.nodeCount,
        updatedAt: Date.now(),
      }
      try {
        Storage.set(key, result)
      } catch {
        /* ignore */
      }
      result.today = todayUsed(key, traffic)
      result.hist = readHist(key)
      return result
    }
    if (fetched.nodeCount > 0) {
      const result: SubResult = {
        ...sub,
        mode: "nodesOnly",
        nodeCount: fetched.nodeCount,
        updatedAt: Date.now(),
      }
      try {
        Storage.set(key, result)
      } catch {
        /* ignore */
      }
      return result
    }
    throw new Error("订阅未返回可识别的流量信息")
  } catch (error) {
    const msg = String((error as any)?.message || error || "加载失败")
    const cached = (Storage.get(key) as any) as SubResult | null
    if (cached && (cached.traffic || cached.nodeCount)) {
      const today = cached.traffic ? todayUsed(key, cached.traffic) : null
      return { ...sub, ...cached, mode: "stale", error: msg, today, hist: readHist(key) }
    }
    return { ...sub, mode: "error", error: msg }
  }
}

export async function loadAll(config: AppConfig): Promise<SubResult[]> {
  const subs = config.subs.filter(s => s.url)
  if (!subs.length) return []
  return Promise.all(subs.map(s => loadOne(s, config.userAgent)))
}

// ---------------------------------------------------------------------------
// 计算
// ---------------------------------------------------------------------------

export function daysUntil(ts: number): number | null {
  if (!ts) return null
  return Math.ceil((ts - Date.now()) / 86400000)
}

export function nextReset(resetDayStr: string): { days: number; date: number } | null {
  const resetDay = Number(resetDayStr)
  if (!resetDayStr || !Number.isFinite(resetDay) || resetDay < 1 || resetDay > 31) return null
  const now = new Date()
  const last = (y: number, m: number) => new Date(y, m + 1, 0).getDate()
  let y = now.getFullYear()
  let m = now.getMonth()
  let d = Math.min(resetDay, last(y, m))
  if (now.getDate() > d) {
    m += 1
    if (m > 11) {
      m = 0
      y += 1
    }
    d = Math.min(resetDay, last(y, m))
  }
  const target = new Date(y, m, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return { days: Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000)), date: target.getTime() }
}

export function pctLeft(t: Traffic | undefined): number | null {
  if (!t || t.unlimited || !Number.isFinite(t.total as number) || (t.total as number) <= 0) return null
  return Math.max(0, Math.min(1, (t.remaining as number) / (t.total as number)))
}

export function fmtBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes)) return "不限量"
  if (bytes <= 0) return "0 B"
  const units = ["B", "KB", "MB", "GB", "TB", "PB"]
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const v = bytes / 1024 ** i
  return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? Math.min(1, decimals) : decimals)} ${units[i]}`
}

export function splitBytes(bytes: number): { n: string; u: string } {
  const s = fmtBytes(bytes)
  const k = s.lastIndexOf(" ")
  return k > 0 ? { n: s.slice(0, k), u: s.slice(k + 1) } : { n: s, u: "" }
}

export function fmtDate(ts: number): string {
  if (!ts) return "长期有效"
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function fmtTime(ts?: number): string {
  if (!ts) return "--"
  const d = new Date(ts)
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export function dailyBudget(s: SubResult): number | null {
  const t = s.traffic
  if (!t || t.unlimited || !Number.isFinite(t.remaining)) return null
  const cands: number[] = []
  const r = nextReset(s.resetDay)
  if (r) cands.push(Math.max(1, r.days))
  const e = daysUntil(t.expireAt)
  if (e != null && e > 0) cands.push(e)
  if (!cands.length) return null
  return (t.remaining as number) / Math.min(...cands)
}

export function forecast(s: SubResult): { text: string; color: string } {
  const t = s.traffic
  if (!t || t.unlimited || !Number.isFinite(t.remaining)) return { text: "不限量", color: C.ok }
  const past = (s.hist || []).slice(0, 6).filter(v => v != null && v > 0)
  const vals = past.length ? (past as number[]) : s.today && s.today > 0 ? [s.today] : []
  if (!vals.length) return { text: "用量统计中…", color: C.warn }
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length
  const days = Math.floor((t.remaining as number) / avg)
  const r = nextReset(s.resetDay)
  const e = daysUntil(t.expireAt)
  const limit = Math.min(...[r ? r.days : Infinity, e != null ? e : Infinity])
  if (days > 999) return { text: "按近期速度 充足", color: C.ok }
  if (Number.isFinite(limit) && days >= limit) return { text: `预计够用 ${days} 天 ✓`, color: C.ok }
  if (Number.isFinite(limit)) return { text: `约 ${days} 天用完 · 早于重置`, color: C.warn }
  return { text: `预计还能用 ${days} 天`, color: days <= 7 ? C.warn : C.ok }
}

export function statusOf(s: SubResult): { label: string; color: string } {
  if (s.mode === "error") return { label: "失败", color: C.fail }
  if (s.mode === "stale") return { label: "缓存", color: C.warn }
  if (s.mode === "nodesOnly") return { label: "节点", color: C.accent }
  const t = s.traffic!
  const days = daysUntil(t.expireAt)
  const p = pctLeft(t)
  if ((!t.unlimited && (t.remaining as number) <= 0) || (days != null && days <= 0))
    return { label: "已到期", color: C.fail }
  if ((p != null && p <= 0.2) || (days != null && days <= 7)) return { label: "偏低", color: C.warn }
  return { label: "正常", color: C.ok }
}

export function subLine(s: SubResult): string {
  const t = s.traffic!
  const parts: string[] = []
  const e = daysUntil(t.expireAt)
  parts.push(e == null ? "长期有效" : `到期 ${Math.max(0, e)} 天`)
  const r = nextReset(s.resetDay)
  if (r) parts.push(r.days === 0 ? "今日重置" : `重置 ${r.days} 天`)
  if (s.nodeCount && s.nodeCount > 0) parts.push(`${s.nodeCount} 节点`)
  return parts.join(" · ")
}

export function titleOf(list: SubResult[], config: AppConfig): string {
  const t = config.title.trim()
  if (t) return t
  return list.length === 1 ? list[0].name : "订阅流量"
}

// ---------------------------------------------------------------------------
// Canvas 绘制（替代 Egern 的 SVG data URI）
// ---------------------------------------------------------------------------

function roundRectPath(
  ctx: CanvasRenderingContext,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

export function Rings({
  values,
  size,
  stroke,
  gap,
}: {
  values: { pct: number; color: string }[]
  size: number
  stroke: number
  gap: number
}) {
  return (
    <Canvas
      opaque={false}
      frame={{ width: size, height: size }}
      draw={(ctx: CanvasRenderingContext, _s: CanvasSize) => {
        const h = size / 2
        const cx = h
        const cy = h
        values.forEach((v, i) => {
          const r = h - stroke / 2 - i * (stroke + gap)
          if (r <= stroke / 2) return
          // 底环
          ctx.globalAlpha = 0.22
          ctx.lineWidth = stroke
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.strokeStyle = v.color
          ctx.stroke()
          // 进度
          const p = Math.max(0, Math.min(1, v.pct || 0))
          if (p > 0) {
            ctx.globalAlpha = 1
            ctx.lineWidth = stroke
            ctx.lineCap = "round"
            if (p >= 0.999) {
              ctx.beginPath()
              ctx.arc(cx, cy, r, 0, Math.PI * 2)
              ctx.strokeStyle = v.color
              ctx.stroke()
            } else {
              ctx.beginPath()
              ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2)
              ctx.strokeStyle = v.color
              ctx.stroke()
            }
          }
        })
        ctx.globalAlpha = 1
      }}
    />
  )
}

export function Bar({
  pct,
  color,
  height,
}: {
  pct: number
  color: string
  height: number
}) {
  const p = Math.max(0, Math.min(1, pct || 0))
  return (
    <Canvas
      opaque={false}
      frame={{ maxWidth: "infinity", height }}
      draw={(ctx: CanvasRenderingContext, size: CanvasSize) => {
        const width = size.width
        const r = height / 2
        // 轨道
        ctx.globalAlpha = 0.2
        ctx.fillStyle = color
        roundRectPath(ctx, 0, 0, width, height, r)
        ctx.fill()
        // 填充
        ctx.globalAlpha = 1
        const fw = p > 0 ? Math.max(height, width * p) : 0
        if (fw >= 1) {
          roundRectPath(ctx, 0, 0, fw, height, r)
          ctx.fill()
        }
      }}
    />
  )
}

export function Spark({
  values,
  color,
  width,
  height,
}: {
  values: (number | null)[]
  color: string
  width: number
  height: number
}) {
  return (
    <Canvas
      opaque={false}
      frame={{ width, height }}
      draw={(ctx: CanvasRenderingContext) => {
        const n = values.length
        const gap = 3
        const bw = (width - gap * (n - 1)) / n
        const max = Math.max(1, ...values.map(v => v || 0))
        ctx.fillStyle = color
        values.forEach((v, i) => {
          const x = i * (bw + gap)
          const bh = v ? Math.max(2, (v / max) * height) : 2
          const op = v == null ? 0.15 : i === n - 1 ? 1 : 0.55
          ctx.globalAlpha = op
          roundRectPath(ctx, x, height - bh, bw, bh, Math.min(2, bw / 2))
          ctx.fill()
        })
        ctx.globalAlpha = 1
      }}
    />
  )
}

export function Week({
  list,
  height,
}: {
  list: SubResult[]
  height: number
}) {
  return (
    <Canvas
      opaque={false}
      frame={{ maxWidth: "infinity", height }}
      draw={(ctx: CanvasRenderingContext, size: CanvasSize) => {
        const width = size.width
        const n = 7
        const groupGap = 10
        const m = list.length || 1
        const gw = (width - groupGap * (n - 1)) / n
        const bw = Math.max(2, (gw - 2 * (m - 1)) / m)
        const vals = list.map(s => (s.hist || [null, null, null, null, null, null, s.today]).map(v => v || 0))
        const max = Math.max(1, ...vals.flat())
        list.forEach((s, k) => {
          ctx.fillStyle = colorOf(k)
          for (let d = 0; d < n; d++) {
            const v = vals[k][d] || 0
            const bh = v ? Math.max(2, (v / max) * (height - 1)) : 2
            const x = d * (gw + groupGap) + k * (bw + 2)
            const op = v ? (d === n - 1 ? 1 : 0.6) : 0.15
            ctx.globalAlpha = op
            roundRectPath(ctx, x, height - bh, bw, bh, Math.min(2.5, bw / 2))
            ctx.fill()
          }
        })
        ctx.globalAlpha = 1
      }}
    />
  )
}

export function Gauge({
  pct,
  color,
  width,
}: {
  pct: number
  color: string
  width: number
}) {
  const stroke = 12
  const r = (width - stroke) / 2
  const cx = width / 2
  const cy = width / 2
  const h = width / 2 + stroke / 2
  const p = Math.max(0, Math.min(1, pct || 0))
  return (
    <Canvas
      opaque={false}
      frame={{ width, height: h }}
      draw={(ctx: CanvasRenderingContext) => {
        ctx.lineWidth = stroke
        ctx.lineCap = "round"
        // 底弧（上半圆）
        ctx.globalAlpha = 0.22
        ctx.strokeStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, r, Math.PI, Math.PI * 2)
        ctx.stroke()
        // 进度弧
        if (p > 0.005) {
          ctx.globalAlpha = 1
          ctx.strokeStyle = color
          ctx.beginPath()
          ctx.arc(cx, cy, r, Math.PI, Math.PI + Math.PI * p)
          ctx.stroke()
        }
        ctx.globalAlpha = 1
      }}
    />
  )
}
