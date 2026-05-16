import { vi, beforeEach, afterEach } from 'vitest'

// Auto-cleanup React Testing Library mounts between tests in jsdom envs.
afterEach(async () => {
  if (typeof window === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})

if (typeof window !== 'undefined') {
  if (!('matchMedia' in window)) {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => undefined,
        removeListener: () => undefined,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        dispatchEvent: () => false,
      }),
    })
  }

  if (typeof globalThis.requestAnimationFrame !== 'function') {
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0) as unknown as number,
    })
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: (id: number) => clearTimeout(id as unknown as NodeJS.Timeout),
    })
  }

  if (!('ResizeObserver' in globalThis)) {
    class FakeResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, 'ResizeObserver', { configurable: true, value: FakeResizeObserver })
  }

  if (!('clipboard' in navigator)) {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  }

  if (!('btoa' in globalThis)) {
    Object.defineProperty(globalThis, 'btoa', {
      configurable: true,
      value: (s: string) => Buffer.from(s, 'binary').toString('base64'),
    })
  }
}

beforeEach(() => {
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})
