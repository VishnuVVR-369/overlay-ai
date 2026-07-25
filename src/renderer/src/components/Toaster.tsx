import { useEffect, useState } from 'react'
import { AlertTriangle, AlertOctagon, Info } from 'lucide-react'
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
        <div key={t.id} className={`toast toast-${t.level}`}>
          <span className="toast-icon">{iconFor(t.level)}</span>
          <span>{t.message}</span>
        </div>
      ))}
    </div>
  )
}

function iconFor(level: ToastEvent['level']): JSX.Element {
  if (level === 'error') return <AlertOctagon size={13} strokeWidth={1.75} />
  if (level === 'warn') return <AlertTriangle size={13} strokeWidth={1.75} />
  return <Info size={13} strokeWidth={1.75} />
}
