import {
  Navigation,
  NavigationStack,
  List,
  Section,
  Picker,
  TextField,
  Button,
  Text,
  VStack,
  HStack,
  Spacer,
  Widget,
  Script,
  Device,
  useState,
} from "scripting"
import {
  loadConfig,
  saveConfig,
  DEFAULT_CONFIG,
  type AppConfig,
  type SubConfig,
} from "./shared"

const MAX_SUBS = 4

function ConfigView() {
  const [config, setConfig] = useState<AppConfig>(() => loadConfig())
  const [family, setFamily] = useState<string>("systemMedium")

  const update = (patch: Partial<AppConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    saveConfig(next)
  }

  const updateSub = (i: number, patch: Partial<SubConfig>) => {
    const subs = config.subs.slice()
    while (subs.length <= i) {
      subs.push({ url: "", name: "", resetDay: "", planGB: "" })
    }
    subs[i] = { ...subs[i], ...patch }
    update({ subs })
  }

  const previewSizes: Record<string, { width: number; height: number }> = {
    systemSmall: { width: 158, height: 158 },
    systemMedium: { width: 338, height: 158 },
    systemLarge: { width: 338, height: 354 },
  }

  return (
    <NavigationStack>
      <List navigationTitle="订阅流量监控" navigationBarTitleDisplayMode="inline">
        <Section header={<Text>预览尺寸</Text>}>
          <Picker
            label={<Text>尺寸</Text>}
            value={family}
            onChanged={(v: any) => setFamily(v as string)}
            pickerStyle="segmented"
          >
            <Text tag="systemSmall">小</Text>
            <Text tag="systemMedium">中</Text>
            <Text tag="systemLarge">大</Text>
          </Picker>
        </Section>

        {Array.from({ length: MAX_SUBS }).map((_, i) => {
          const sub = config.subs[i] || { url: "", name: "", resetDay: "", planGB: "" }
          return (
            <Section key={i} header={<Text>{`订阅 ${i + 1}`}</Text>}>
              <TextField
                label={<Text>链接</Text>}
                value={sub.url}
                prompt="https://..."
                textFieldStyle="roundedBorder"
                onChanged={(v: string) => updateSub(i, { url: v })}
              />
              <TextField
                label={<Text>名称</Text>}
                value={sub.name}
                prompt="显示在组件上"
                textFieldStyle="roundedBorder"
                onChanged={(v: string) => updateSub(i, { name: v })}
              />
              <TextField
                label={<Text>每月重置日 (1-31)</Text>}
                value={sub.resetDay}
                prompt="留空不显示"
                textFieldStyle="roundedBorder"
                onChanged={(v: string) => updateSub(i, { resetDay: v })}
              />
              <TextField
                label={<Text>套餐总量 (GB)</Text>}
                value={sub.planGB}
                prompt="仅返回剩余时估算，默认 100"
                textFieldStyle="roundedBorder"
                onChanged={(v: string) => updateSub(i, { planGB: v })}
              />
            </Section>
          )
        })}

        <Section header={<Text>通用</Text>}>
          <TextField
            label={<Text>组件标题</Text>}
            value={config.title}
            prompt="多订阅时显示，默认「订阅流量」"
            textFieldStyle="roundedBorder"
            onChanged={(v: string) => update({ title: v })}
          />
          <TextField
            label={<Text>刷新间隔 (小时, 0.5-24)</Text>}
            value={String(config.refreshHours)}
            prompt="2"
            textFieldStyle="roundedBorder"
            onChanged={(v: string) => update({ refreshHours: Number.isFinite(Number(v)) ? Number(v) : 2 })}
          />
          <TextField
            label={<Text>自定义 User-Agent</Text>}
            value={config.userAgent}
            prompt="留空自动尝试常见标识"
            textFieldStyle="roundedBorder"
            onChanged={(v: string) => update({ userAgent: v })}
          />
        </Section>

        <Section>
          <Button
            title="恢复默认"
            action={() => {
              setConfig(JSON.parse(JSON.stringify(DEFAULT_CONFIG)))
              saveConfig(DEFAULT_CONFIG)
            }}
          />
          <Button
            title="在组件中预览"
            action={async () => {
              try {
                await Widget.preview({ family: family as any })
              } catch (e) {
                console.log(String((e as any)?.message || e))
              }
            }}
          />
        </Section>
      </List>
    </NavigationStack>
  )
}

async function run() {
  await Navigation.present({ element: <ConfigView /> })
  Script.exit()
}

run()
