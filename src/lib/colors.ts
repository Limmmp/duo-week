/**
 * Цвета участников и тегов — из проверенной категориальной палитры (скилл dataviz):
 * у каждого светлого оттенка свой шаг для тёмной темы. Синий и бирюзовый заняты статусами
 * «в работе» и «готово», поэтому участникам по умолчанию достаются остальные.
 */
export const PALETTE: { light: string; dark: string; name: string }[] = [
  { light: '#4a3aa7', dark: '#9085e9', name: 'Фиолетовый' },
  { light: '#eb6834', dark: '#d95926', name: 'Оранжевый' },
  { light: '#e87ba4', dark: '#d55181', name: 'Розовый' },
  { light: '#eda100', dark: '#c98500', name: 'Жёлтый' },
  { light: '#008300', dark: '#008300', name: 'Зелёный' },
  { light: '#2a78d6', dark: '#3987e5', name: 'Синий' },
  { light: '#1baf7a', dark: '#199e70', name: 'Бирюзовый' },
  { light: '#e34948', dark: '#e66767', name: 'Красный' },
]

const DARK = new Map(PALETTE.map((p) => [p.light, p.dark]))

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

/** Белый или почти чёрный — что читается лучше на этом фоне. */
function onColor(hex: string): string {
  const l = luminance(hex)
  return contrast(l, 1) >= contrast(l, luminance('#1f2328')) ? '#ffffff' : '#1f2328'
}

/** CSS-значение, которое само переключается со сменой темы (color-scheme). */
export function memberColor(hex: string): string {
  return `light-dark(${hex}, ${DARK.get(hex) ?? hex})`
}

export function memberInk(hex: string): string {
  const dark = DARK.get(hex) ?? hex
  return `light-dark(${onColor(hex)}, ${onColor(dark)})`
}

/** Следующий свободный цвет для нового участника. */
export function nextMemberColor(used: string[]): string {
  return (PALETTE.slice(0, 5).find((p) => !used.includes(p.light)) ?? PALETTE[0]).light
}

/** Тег получает постоянный цвет точки по хешу названия. */
export function tagColor(tag: string): string {
  let h = 0
  for (const ch of tag) h = (h * 31 + ch.codePointAt(0)!) >>> 0
  const p = PALETTE[h % PALETTE.length]
  return `light-dark(${p.light}, ${p.dark})`
}
