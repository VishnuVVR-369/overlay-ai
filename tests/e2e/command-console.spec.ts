import { test, expect } from '@playwright/test'
import { launchApp } from './launch'

test('setup, console navigation, and command palette work in the packaged renderer', async () => {
  const { app, page } = await launchApp()
  try {
    await expect(page.getByRole('dialog', { name: 'Overlay console' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Setup' })).toHaveAttribute('aria-current', 'page')

    await page.getByRole('button', { name: 'Help' }).click()
    await expect(page.getByRole('heading', { name: 'How it works' })).toBeVisible()

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K')
    const search = page.getByRole('textbox', { name: 'Search actions' })
    await expect(search).toBeFocused()
    await search.fill('history')
    await page.getByRole('option', { name: /Mock history & scores/ }).click()

    await expect(page.getByRole('button', { name: 'History' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByText(/No mock sessions yet/)).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0)
  } finally {
    await app.close()
  }
})
