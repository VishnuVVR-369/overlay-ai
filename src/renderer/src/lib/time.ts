/** `hh:mm` on a 24-hour clock. */
export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** `hh:mm:ss` on a 24-hour clock. */
export function formatTimeSeconds(ts: number): string {
  const d = new Date(ts)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** A duration as `m:ss`, or `h:mm:ss` once it passes an hour. Never negative. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

/** Milliseconds left until `endsAt`, clamped at zero. `null` when open-ended. */
export function remainingMs(endsAt: number | undefined, now: number): number | null {
  if (typeof endsAt !== 'number') return null
  return Math.max(0, endsAt - now)
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}
