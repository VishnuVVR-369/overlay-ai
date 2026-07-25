import { useCallback, useEffect, useRef, useState } from 'react'

/** Copy-to-clipboard with a short-lived "copied" flag for button feedback. */
export function useCopy(resetAfterMs = 1400): { copied: boolean; copy: (text: string) => void } {
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const copy = useCallback(
    (text: string) => {
      void navigator.clipboard?.writeText(text)
      setCopied(true)
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), resetAfterMs)
    },
    [resetAfterMs],
  )

  return { copied, copy }
}
