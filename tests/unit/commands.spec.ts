import { describe, expect, it } from 'vitest'
import {
  COMMANDS,
  commandTitle,
  getCommand,
  searchCommands,
  visibleCommands,
  type CommandContext,
} from '@/commands'

const ctx = (over: Partial<CommandContext> = {}): CommandContext => ({
  running: false,
  mockActive: false,
  mockPaused: false,
  mode: 'normal',
  hasTranscript: false,
  hasAnswer: false,
  ...over,
})

describe('command registry', () => {
  it('has unique ids', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every command a label and a hint, so the palette is never blank', () => {
    for (const command of COMMANDS) {
      expect(command.label(ctx()).length).toBeGreaterThan(0)
      expect(command.hint.length).toBeGreaterThan(0)
    }
  })

  it('marks exactly the accelerators that main registers as global', () => {
    const globals = COMMANDS.filter((c) => c.scope === 'global').map((c) => c.id).sort()
    expect(globals).toEqual(['ask', 'cycleSize', 'hide', 'listen', 'panic', 'screenAsk'].sort())
  })

  it('gives every global command a visible key combination', () => {
    for (const command of COMMANDS.filter((c) => c.scope === 'global')) {
      expect(command.keys.length).toBeGreaterThan(0)
    }
  })

  it('throws on an unknown id rather than silently rendering nothing', () => {
    expect(() => getCommand('nope' as never)).toThrow(/Unknown command/)
  })

  it('relabels stateful commands', () => {
    expect(getCommand('listen').label(ctx({ running: false }))).toBe('Start listening')
    expect(getCommand('listen').label(ctx({ running: true }))).toBe('Stop listening')
    expect(getCommand('mock').label(ctx({ mockActive: true }))).toBe('End mock interview')
    expect(getCommand('mockPause').label(ctx({ mockPaused: true }))).toBe('Resume mock interviewer')
  })

  it('hides commands that cannot apply yet', () => {
    const ids = visibleCommands(ctx()).map((c) => c.id)
    expect(ids).not.toContain('clearTranscript')
    expect(ids).not.toContain('copyAnswer')
    expect(ids).not.toContain('mockPause')

    const live = visibleCommands(ctx({ hasTranscript: true, hasAnswer: true, mockActive: true })).map((c) => c.id)
    expect(live).toContain('clearTranscript')
    expect(live).toContain('copyAnswer')
    expect(live).toContain('mockPause')
  })

  it('appends the shortcut to tooltips only when there is one', () => {
    expect(commandTitle('listen', ctx())).toContain('Start listening')
    expect(commandTitle('listen', ctx())).toMatch(/·/)
    expect(commandTitle('history', ctx())).toBe('Mock history & scores')
  })
})

describe('searchCommands', () => {
  it('returns everything available for an empty query', () => {
    expect(searchCommands('', ctx())).toEqual(visibleCommands(ctx()))
    expect(searchCommands('   ', ctx())).toEqual(visibleCommands(ctx()))
  })

  it('ranks a label prefix above a keyword above a hint mention', () => {
    const results = searchCommands('ask', ctx())
    expect(results[0].id).toBe('ask')
  })

  it('matches on keywords that never appear in the label', () => {
    expect(searchCommands('settings', ctx()).map((c) => c.id)).toContain('setup')
    expect(searchCommands('resume', ctx()).map((c) => c.id)).toContain('context')
    expect(searchCommands('stealth', ctx()).map((c) => c.id)).toContain('hide')
  })

  it('is case-insensitive', () => {
    expect(searchCommands('SCREEN', ctx()).map((c) => c.id)).toContain('screenAsk')
  })

  it('never surfaces an unavailable command through search', () => {
    expect(searchCommands('clear', ctx()).map((c) => c.id)).not.toContain('clearTranscript')
    expect(searchCommands('clear', ctx({ hasTranscript: true })).map((c) => c.id)).toContain('clearTranscript')
  })

  it('returns nothing for a query that matches nothing', () => {
    expect(searchCommands('zzzzqqq', ctx())).toEqual([])
  })
})
