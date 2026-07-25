import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  // ELECTRON_RUN_AS_NODE turns the binary into plain node, which makes every
  // launch fail with an opaque "Process failed to launch". Some shells and CI
  // images export it, so strip it rather than inherit it.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env
  const userDataDir = mkdtempSync(join(tmpdir(), 'overlay-ai-e2e-'))
  let app: ElectronApplication | null = null

  try {
    app = await electron.launch({
      args: [resolve(repoRoot, 'out/main/index.js'), `--user-data-dir=${userDataDir}`],
      cwd: repoRoot,
      env: { ...env, NODE_ENV: 'test' },
    })
    app.once('close', () => rmSync(userDataDir, { recursive: true, force: true }))
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    return { app, page }
  } catch (error) {
    if (app) await app.close().catch(() => undefined)
    rmSync(userDataDir, { recursive: true, force: true })
    throw error
  }
}
