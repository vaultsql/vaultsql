import { Description, Label } from '@/components/catalyst/fieldset'
import { Radio, RadioField, RadioGroup } from '@/components/catalyst/radio'
import { useTheme } from './use-theme'

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <RadioGroup value={theme} onChange={setTheme}>
      <RadioField>
        <Radio value="light" />
        <Label>Light</Label>
        <Description>Use light theme</Description>
      </RadioField>
      <RadioField>
        <Radio value="dark" />
        <Label>Dark</Label>
        <Description>Use dark theme</Description>
      </RadioField>
    </RadioGroup>
  )
}
