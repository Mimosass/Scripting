import {
  Navigation,
  NavigationStack,
  VStack,
  List,
  Section,
  Picker,
  Toggle,
  ColorPicker,
  Text,
  Button,
  Widget,
  Script,
  useState,
  Device,
} from "scripting"
import {
  loadConfig,
  saveConfig,
  DEFAULT_CONFIG,
  Config,
  Mode,
  DaysDotsContent,
  PREVIEW_SIZES,
  Family,
} from "./daysDots"

function ConfigView() {
  const [config, setConfig] = useState<Config>(() => loadConfig())
  const [family, setFamily] = useState<Family>("systemMedium")
  const scheme = Device.colorScheme === "dark" ? "dark" : "light"

  const update = (patch: Partial<Config>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    saveConfig(next)
  }

  const size = PREVIEW_SIZES[family]

  return (
    <NavigationStack>
      <List
        navigationTitle="Days Dots 配置"
        navigationBarTitleDisplayMode="inline"
      >
        <Section header={<Text>预览</Text>}>
          <VStack alignment="center" spacing={10}>
            <Picker
              label={<Text>尺寸</Text>}
              value={family as string}
              onChanged={(v: any) => setFamily(v as Family)}
              pickerStyle="segmented"
            >
              <Text tag="systemSmall">小</Text>
              <Text tag="systemMedium">中</Text>
              <Text tag="systemLarge">大</Text>
            </Picker>
            <DaysDotsContent
              config={config}
              size={size}
              family={family}
              scheme={scheme}
              inWidget={false}
              mode={config.progressType}
              weekStartsOn={config.weekStartsOn}
            />
          </VStack>
        </Section>

        <Section header={<Text>进度类型</Text>}>
          <Picker
            label={<Text>进度类型</Text>}
            value={config.progressType as string}
            onChanged={(v: any) => update({ progressType: v as Mode })}
            pickerStyle="segmented"
          >
            <Text tag="year">本年</Text>
            <Text tag="month">本月</Text>
          </Picker>
        </Section>

        <Section header={<Text>每周开始日（仅本月视图）</Text>}>
          <Picker
            label={<Text>每周开始日</Text>}
            value={config.weekStartsOn as number}
            onChanged={(v: any) => update({ weekStartsOn: v as 0 | 1 })}
            pickerStyle="segmented"
          >
            <Text tag={0 as 0}>周日</Text>
            <Text tag={1 as 1}>周一</Text>
          </Picker>
        </Section>

        <Section header={<Text>显示</Text>}>
          <Toggle
            value={config.showPercent}
            onChanged={(v) => update({ showPercent: v })}
            title="显示百分比"
          />
        </Section>

        <Section header={<Text>颜色 · 亮色 / 暗色</Text>}>
          <ColorPicker
            title="已过去（亮色）"
            value={config.active.light}
            supportsOpacity={false}
            onChanged={(c) =>
              update({ active: { ...config.active, light: c } })
            }
          />
          <ColorPicker
            title="已过去（暗色）"
            value={config.active.dark}
            supportsOpacity={false}
            onChanged={(c) => update({ active: { ...config.active, dark: c } })}
          />
          <ColorPicker
            title="剩余（亮色）"
            value={config.inactive.light}
            supportsOpacity={false}
            onChanged={(c) =>
              update({ inactive: { ...config.inactive, light: c } })
            }
          />
          <ColorPicker
            title="剩余（暗色）"
            value={config.inactive.dark}
            supportsOpacity={false}
            onChanged={(c) =>
              update({ inactive: { ...config.inactive, dark: c } })
            }
          />
          <ColorPicker
            title="背景（亮色）"
            value={config.background.light}
            onChanged={(c) =>
              update({ background: { ...config.background, light: c } })
            }
          />
          <ColorPicker
            title="背景（暗色）"
            value={config.background.dark}
            onChanged={(c) =>
              update({ background: { ...config.background, dark: c } })
            }
          />
        </Section>

        <Section>
          <Button
            title="恢复默认设置"
            action={() => {
              setConfig(DEFAULT_CONFIG)
              saveConfig(DEFAULT_CONFIG)
            }}
          />
          <Button
            title="在小组件中预览"
            action={async () => {
              const paramOptions: Record<string, string> = {
                本年: JSON.stringify("year"),
                本月: JSON.stringify("month"),
                应用配置: JSON.stringify(""),
              }
              await Widget.preview({
                family,
                parameters: {
                  options: paramOptions,
                  default: "应用配置",
                },
              })
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
