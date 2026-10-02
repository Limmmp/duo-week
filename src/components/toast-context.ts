import { createContext, useContext } from 'react'

export type ToastAction = { label: string; onClick: () => void }

export const ToastContext = createContext<(message: string, action?: ToastAction) => void>(() => {})

export const useToast = () => useContext(ToastContext)
