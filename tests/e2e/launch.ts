import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron, type ElectronApplication, type Page } from 'playwright'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '..', '..')
const productName = 'Overlay AI'

export async function launchApp(): Promise<{ app: ElectronApplication; page: Page }> {
  // ELECTRON_RUN_AS_NODE turns the binary into plain node, which makes every
  // launch fail with an opaque "Process failed to launch". Some shells and CI
  // images export it, so strip it rather than inherit it.
  const { ELECTRON_RUN_AS_NODE: _ignored, ...env } = process.env
  const userDataDir = mkdtempSync(join(tmpdir(), 'overlay-ai-e2e-'))
  let app: ElectronApplication | null = null

  try {
    app = await electron.launch({
      executablePath: packagedExecutable(),
      args: [`--user-data-dir=${userDataDir}`],
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

function packagedExecutable(): string {
  const releaseDir = resolve(repoRoot, 'release')
  if (!existsSync(releaseDir)) {
    throw new Error('Packaged app not found. Run npm run build && npm run package:e2e first.')
  }
  const candidates = readdirSync(releaseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('mac'))
    .map((entry) => join(releaseDir, entry.name, `${productName}.app`, 'Contents', 'MacOS', productName))
    .filter(existsSync)
    .sort()
  if (candidates.length !== 1) {
    throw new Error(`Expected one packaged app executable, found ${candidates.length}.`)
  }
  return candidates[0]
}
