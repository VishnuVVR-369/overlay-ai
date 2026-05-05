import { useLayoutEffect, useRef } from 'react'
import { useAudioLevelsStore, AUDIO_HISTORY } from '../state/audio-levels-store'
import { useStatusStore } from '../state/status-store'

interface Props {
  height?: number
  className?: string
}

const STROKE_YOU = 'rgba(122, 163, 197, 0.85)'
const STROKE_THEM = 'rgba(212, 165, 116, 0.85)'
const FILL_YOU = 'rgba(122, 163, 197, 0.18)'
const FILL_THEM = 'rgba(212, 165, 116, 0.18)'
const CENTER_LINE = 'rgba(255, 255, 255, 0.06)'

export function SeamWaveform({ height = 28, className = '' }: Props): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null)
  const youPathRef = useRef<SVGPathElement>(null)
  const youFillRef = useRef<SVGPathElement>(null)
  const themPathRef = useRef<SVGPathElement>(null)
  const themFillRef = useRef<SVGPathElement>(null)
  const widthRef = useRef(0)
  const running = useStatusStore((s) => s.running)

  // Subscribe to the store via useEffect-style raf draw, not via re-render
  useLayoutEffect(() => {
    let raf = 0
    let alive = true

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) widthRef.current = e.contentRect.width
    })
    if (svgRef.current) ro.observe(svgRef.current)

    const draw = (): void => {
      if (!alive) return
      const w = widthRef.current || (svgRef.current?.clientWidth ?? 0)
      const h = height
      const center = h / 2
      const half = h / 2 - 1

      const { mic, system } = useAudioLevelsStore.getState()
      const stride = w / Math.max(1, AUDIO_HISTORY - 1)

      const buildLine = (data: Float32Array, sign: number): string => {
        let d = ''
        for (let i = 0; i < AUDIO_HISTORY; i++) {
          const x = (i * stride).toFixed(2)
          const amp = Math.max(0, Math.min(1, data[i]))
          const y = (center - sign * amp * half).toFixed(2)
          d += i === 0 ? `M${x} ${y}` : ` L${x} ${y}`
        }
        return d
      }

      const buildFill = (data: Float32Array, sign: number): string => {
        let d = `M0 ${center.toFixed(2)}`
        for (let i = 0; i < AUDIO_HISTORY; i++) {
          const x = (i * stride).toFixed(2)
          const amp = Math.max(0, Math.min(1, data[i]))
          const y = (center - sign * amp * half).toFixed(2)
          d += ` L${x} ${y}`
        }
        d += ` L${(w).toFixed(2)} ${center.toFixed(2)} Z`
        return d
      }

      youPathRef.current?.setAttribute('d', buildLine(mic, +1))
      themPathRef.current?.setAttribute('d', buildLine(system, -1))
      youFillRef.current?.setAttribute('d', buildFill(mic, +1))
      themFillRef.current?.setAttribute('d', buildFill(system, -1))

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [height])

  return (
    <svg
      ref={svgRef}
      className={`seam-waveform ${running ? 'live' : ''} ${className}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      aria-hidden
    >
      <line
        x1="0"
        x2="100%"
        y1={height / 2}
        y2={height / 2}
        stroke={CENTER_LINE}
        strokeWidth={1}
        shapeRendering="crispEdges"
      />
      <path ref={themFillRef} fill={FILL_THEM} stroke="none" />
      <path ref={youFillRef} fill={FILL_YOU} stroke="none" />
      <path
        ref={themPathRef}
        fill="none"
        stroke={STROKE_THEM}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        ref={youPathRef}
        fill="none"
        stroke={STROKE_YOU}
        strokeWidth={1}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}
