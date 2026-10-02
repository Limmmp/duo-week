import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { ToastContext, type ToastAction } from './toast-context'

type Toast = { id: number; message: string; action?: ToastAction }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), [])
  const show = useCallback((message: string, action?: ToastAction) => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-2), { id, message, action }])
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const dismissRef = useRef(onDismiss)
  useEffect(() => {
    dismissRef.current = onDismiss
  })
  useEffect(() => {
    const timer = setTimeout(() => dismissRef.current(), toast.action ? 6000 : 3500)
    return () => clearTimeout(timer)
  }, [toast.id, toast.action])

  return (
    <div className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-ink py-2 pl-4 pr-2 text-sm text-page shadow-pop animate-rise">
      <span className="min-w-0 flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick()
            onDismiss()
          }}
          className="h-8 rounded-lg px-2.5 font-semibold text-page underline-offset-2 hover:underline"
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Закрыть уведомление"
        className="grid size-8 place-items-center rounded-lg text-page/70 hover:text-page"
      >
        <X size={15} />
      </button>
    </div>
  )
}
