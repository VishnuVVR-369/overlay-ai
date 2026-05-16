import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function makeTempUserData(): { path: string; cleanup: () => void } {
  const path = mkdtempSync(join(tmpdir(), 'overlay-ai-test-'))
  return {
    path,
    cleanup: () => {
      try {
        rmSync(path, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    },
  }
}
