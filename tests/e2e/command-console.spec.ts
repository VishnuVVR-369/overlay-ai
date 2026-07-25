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

test('Setup shortcuts remain available while typing personal context', async ({}, testInfo) => {
  const { app, page } = await launchApp()
  try {
    await page.getByRole('button', { name: 'Context' }).click()
    const resume = page.getByRole('textbox', { name: /Resume \/ background/ })
    await resume.fill('Candidate background')
    await resume.press('?')

    await expect(resume).toHaveValue('Candidate background?')
    await expect(page.getByRole('button', { name: 'Context', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await page.screenshot({
      path: testInfo.outputPath('personal-context-typing.png'),
    })

    await resume.press('Meta+,')
    await expect(page.getByRole('button', { name: 'Setup' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await page.screenshot({
      path: testInfo.outputPath('setup-opened-from-editable-field.png'),
    })

    await page.getByRole('button', { name: 'Context', exact: true }).click()
    await page.getByRole('textbox', { name: /Resume \/ background/ }).press('Control+,')
    await expect(page.getByRole('button', { name: 'Setup' })).toHaveAttribute(
      'aria-current',
      'page',
    )
  } finally {
    await app.close()
  }
})

test('unsaved personal context survives navigation and reopening the console', async ({}, testInfo) => {
  const { app, page } = await launchApp()
  try {
    await page.getByRole('button', { name: 'Context', exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('textbox', { name: 'Story 1 title' }).fill('Payments migration')
    await page.getByRole('textbox', { name: 'Story 1 body' }).fill('S/T/A/R')
    await expect(page.getByText('0 of 4 sections filled · 1 story')).toBeVisible()

    await page.getByRole('button', { name: 'Prompts' }).click()
    await page.getByRole('button', { name: 'Context', exact: true }).click()

    await expect(page.getByRole('textbox', { name: 'Story 1 title' })).toHaveValue('Payments migration')
    await expect(page.getByRole('button', { name: 'Save personal context' })).toBeEnabled()

    await page.getByRole('button', { name: 'Close console' }).click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+,' : 'Control+,')
    await page.getByRole('button', { name: 'Context', exact: true }).click()

    await expect(page.getByRole('textbox', { name: 'Story 1 title' })).toHaveValue('Payments migration')
    await expect(page.getByRole('button', { name: 'Save personal context' })).toBeEnabled()
    await expect(page.evaluate(() => window.api.vault.get())).resolves.toMatchObject({ stories: [] })
    await page.getByRole('textbox', { name: 'Story 1 title' }).scrollIntoViewIfNeeded()
    await page.screenshot({ path: testInfo.outputPath('context-draft-after-reopen.png') })
  } finally {
    await app.close()
  }
})

test('an incomplete story is flagged instead of vanishing on save', async () => {
  const { app, page } = await launchApp()
  try {
    await page.getByRole('button', { name: 'Context', exact: true }).click()
    await page.getByRole('button', { name: 'Add' }).click()
    await page.getByRole('textbox', { name: 'Story 1 title' }).fill('Payments migration')

    await expect(page.getByText(/Needs a body before it can be saved/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save personal context' })).toBeDisabled()

    await page.getByRole('textbox', { name: 'Story 1 body' }).fill('S/T/A/R')
    await expect(page.getByRole('button', { name: 'Save personal context' })).toBeEnabled()
  } finally {
    await app.close()
  }
})

test('unsaved system prompt survives console tab navigation', async () => {
  const { app, page } = await launchApp()
  try {
    await page.getByRole('button', { name: 'Prompts' }).click()
    const editor = page.getByRole('textbox', { name: /System prompt for/ })
    await editor.fill('a prompt I am still writing')

    await page.getByRole('button', { name: 'Context', exact: true }).click()
    await page.getByRole('button', { name: 'Prompts' }).click()

    await expect(page.getByRole('textbox', { name: /System prompt for/ })).toHaveValue(
      'a prompt I am still writing',
    )
  } finally {
    await app.close()
  }
})
