import { useEffect, useState } from 'react'
import type { ToastEvent } from '@shared/types'

interface ToastInstance extends ToastEvent {
  id: number
}

export function Toaster(): JSX.Element {
  const [toasts, setToasts] = useState<ToastInstance[]>([])

  useEffect(() => {
    let nextId = 1
    return window.api.ui.onToast((evt) => {
      const id = nextId++
      setToasts((cur) => [...cur, { ...evt, id }])
      setTimeout(() => setToasts((cur) => cur.filter((t) => t.id !== id)), 5000)
    })
  }, [])

  return (
    <div className="toaster">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.level}`}>{t.message}</div>
      ))}
    </div>
  )
}
