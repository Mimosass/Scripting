import { Widget, Device } from "scripting"
import {
  loadConfig,
  DaysDotsContent,
  PREVIEW_SIZES,
  Family,
  Mode,
  Size,
} from "./daysDots"

// 小组件参数：填 `year` / `month` 优先于应用内配置。
// 真实小组件参数是纯字符串 "year"/"month"；Widget.preview 传入的是 JSON 字符串，
// 两种形态都兼容。
function resolveParam(p?: string): Mode | null {
  const raw = (p ?? "").trim()
  if (!raw) return null
  let v = raw
  if (raw.startsWith('"') && raw.endsWith('"')) {
    try {
      v = JSON.parse(raw)
    } catch {
      /* keep raw */
    }
  }
  v = (v || "").toLowerCase()
  if (v === "year" || v === "month") return v
  return null
}

function main() {
  const family = (Widget.family as Family) || "systemMedium"
  const ds = Widget.displaySize
  const size: Size =
    ds && ds.width > 0 ? ds : PREVIEW_SIZES[family] ?? PREVIEW_SIZES.systemMedium

  const cfg = loadConfig()
  const param = resolveParam(Widget.parameter)
  const mode: Mode = param ?? cfg.progressType
  const weekStartsOn = cfg.weekStartsOn
  const scheme = Device.colorScheme === "dark" ? "dark" : "light"

  Widget.present(
    <DaysDotsContent
      config={cfg}
      size={size}
      family={family}
      scheme={scheme}
      inWidget={true}
      mode={mode}
      weekStartsOn={weekStartsOn}
    />,
  )
}

main()
