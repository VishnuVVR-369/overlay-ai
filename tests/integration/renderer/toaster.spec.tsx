// @vitest-environment jsdom
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Toaster } from '@/components/Toaster'
import { installFakeApi, createFakeApi, type FakeApi } from '../../helpers/fake-window-api'

let api: FakeApi

beforeEach(() => {
  vi.useFakeTimers()
  api = installFakeApi(createFakeApi())
})

afterEach(() => {
  vi.useRealTimers()
})

describe('Toaster', () => {
  it('renders nothing initially', () => {
    const { container } = render(<Toaster />)
    expect(container.querySelectorAll('.toast').length).toBe(0)
  })

  it('renders incoming toasts and applies the level-specific class', () => {
    render(<Toaster />)
    act(() => api.__emit.toast({ level: 'error', message: 'oops' }))
    expect(screen.getByText('oops')).toBeTruthy()
    const node = document.querySelector('.toast.toast-error')
    expect(node).toBeTruthy()
  })

  it('auto-dismisses each toast after 5 seconds', () => {
    render(<Toaster />)
    act(() => api.__emit.toast({ level: 'info', message: 'short-lived' }))
    expect(document.querySelectorAll('.toast').length).toBe(1)
    act(() => {
      vi.advanceTimersByTime(4999)
    })
    expect(document.querySelectorAll('.toast').length).toBe(1)
    act(() => {
      vi.advanceTimersByTime(2)
    })
    expect(document.querySelectorAll('.toast').length).toBe(0)
  })

  it('multiple toasts stack and dismiss independently', () => {
    render(<Toaster />)
    act(() => api.__emit.toast({ level: 'info', message: 'a' }))
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    act(() => api.__emit.toast({ level: 'warn', message: 'b' }))
    expect(document.querySelectorAll('.toast').length).toBe(2)
    act(() => {
      vi.advanceTimersByTime(3001)
    })
    expect(document.querySelectorAll('.toast').length).toBe(1)
    expect(screen.getByText('b')).toBeTruthy()
  })
})
