// localStorage может быть недоступен (приватный режим, запрет cookies) — всё через try/catch.
export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // без сохранения просто забудем настройку после перезагрузки
  }
}

const BOARD_KEY = 'duo.boardKey'
const KEY_RE = /^[0-9a-f]{32}$/

/** Принимает ссылку-приглашение целиком или голый ключ. */
export function extractKey(input: string): string | null {
  const value = input.trim().toLowerCase()
  const fromLink = value.match(/[#?&]k=([0-9a-f]{32})/)
  if (fromLink) return fromLink[1]
  return KEY_RE.test(value) ? value : null
}

/** Ключ из адреса (#k=…) важнее сохранённого; после чтения убираем его из адресной строки. */
export function initialBoardKey(): string | null {
  const fromHash = extractKey(location.hash)
  if (fromHash) {
    save(BOARD_KEY, fromHash)
    history.replaceState(null, '', location.pathname + location.search)
    return fromHash
  }
  const stored = load<string | null>(BOARD_KEY, null)
  if (stored !== null) return KEY_RE.test(stored) ? stored : null // '' — доску явно «забыли»
  const dev = import.meta.env.DEV ? (import.meta.env.VITE_DEV_BOARD_KEY as string | undefined) : undefined
  return dev && KEY_RE.test(dev) ? dev : null
}

export const rememberBoardKey = (key: string) => save(BOARD_KEY, key)
export const forgetBoardKey = () => save(BOARD_KEY, '')
export const inviteLink = (key: string) => `${location.origin}${location.pathname}#k=${key}`

export const loadMe = (boardId: string) => load<string | null>(`duo.me.${boardId}`, null)
export const saveMe = (boardId: string, memberId: string) => save(`duo.me.${boardId}`, memberId)
